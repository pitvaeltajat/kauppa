import { getGoogleAccessToken, requireEnv } from '@/lib/googleAuth';

/**
 * Read-only client for the Google Workspace Admin SDK Directory API.
 *
 * Authenticates as a **service account with domain-wide delegation**, not as a
 * signed-in person: the SA impersonates `GOOGLE_WORKSPACE_SUBJECT` (an account
 * with the "read users" admin privilege). This is the only Google auth flow that works
 * unattended (see `lib/googleAuth`). kontti reuses klapi's
 * `klapi-workspace-sync` service account, so these two scopes are already
 * authorised in Admin console → Security → API controls → Domain-wide
 * delegation.
 */

const DIRECTORY_URL = 'https://admin.googleapis.com/admin/directory/v1';

const SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
];

/** One Workspace person as the sync cares about them. */
export type WorkspaceMember = {
  /** Primary email, lowercased. This is the key we match kontti's `User.email` on. */
  email: string;
  /** Full name from the directory, or null if Workspace has none. */
  name: string | null;
  /**
   * True when this person is a current troop member: they exist in the
   * directory, are in the member group, and are neither suspended nor archived.
   * Anyone deleted from Workspace simply never appears in the roster at all.
   */
  active: boolean;
};

/** GETs one Directory endpoint, following `nextPageToken` to the end. */
async function directoryList<T>(
  token: string,
  path: string,
  params: Record<string, string>,
  collect: (page: Record<string, unknown>) => T[],
): Promise<T[]> {
  const results: T[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${DIRECTORY_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(`Directory API ${path} failed (${response.status}): ${await response.text()}`);
    }

    const page = (await response.json()) as Record<string, unknown>;
    results.push(...collect(page));
    pageToken = page.nextPageToken as string | undefined;
  } while (pageToken);

  return results;
}

type DirectoryUser = {
  primaryEmail?: string;
  name?: { fullName?: string };
  suspended?: boolean;
  archived?: boolean;
};

type DirectoryMember = {
  email?: string;
  type?: string;
  status?: string;
};

/**
 * The current Workspace roster: every user in the domain, flagged `active` when
 * they belong to `GOOGLE_WORKSPACE_GROUP` and are neither suspended nor
 * archived.
 *
 * The "belongs to the group" test has a wrinkle. The member group can carry a
 * `type: CUSTOMER` member. This is Workspace's "the whole organisation is in this
 * group" entry, which the API returns verbatim instead of expanding. When it
 * is present we treat every domain user as a member, which is what it means.
 *
 * Throws rather than returning an empty roster: a wrong read must never read as
 * "nobody is a member".
 */
export async function fetchWorkspaceRoster(): Promise<WorkspaceMember[]> {
  const domain = requireEnv('GOOGLE_WORKSPACE_DOMAIN');
  const group = requireEnv('GOOGLE_WORKSPACE_GROUP');
  const token = await getGoogleAccessToken(SCOPES, requireEnv('GOOGLE_WORKSPACE_SUBJECT'));

  const [users, members] = await Promise.all([
    directoryList<DirectoryUser>(
      token,
      '/users',
      { domain, maxResults: '500', projection: 'basic' },
      (page) => (page.users as DirectoryUser[]) ?? [],
    ),
    directoryList<DirectoryMember>(
      token,
      `/groups/${encodeURIComponent(group)}/members`,
      { maxResults: '200' },
      (page) => (page.members as DirectoryMember[]) ?? [],
    ),
  ]);

  if (users.length === 0) {
    throw new Error(`Directory returned no users for domain ${domain}`);
  }
  if (members.length === 0) {
    throw new Error(`Directory returned no members for group ${group}`);
  }

  const wholeDomainIsMember = members.some((member) => member.type === 'CUSTOMER');
  const explicitMembers = new Set(
    members
      .filter((member) => member.type === 'USER' && member.email)
      .map((member) => member.email!.toLowerCase()),
  );

  return users
    .filter((user) => user.primaryEmail)
    .map((user) => {
      const email = user.primaryEmail!.toLowerCase();
      return {
        email,
        name: user.name?.fullName?.trim() || null,
        active:
          (wholeDomainIsMember || explicitMembers.has(email)) && !user.suspended && !user.archived,
      };
    });
}

/**
 * Resolves any address a person has - primary **or alias** - to their Workspace
 * primary email, lowercased. That primary is the one key everything else uses:
 * `fetchWorkspaceRoster` stores it, and Google returns it (never an alias) in
 * the OIDC token at login. So a SUPERADMIN grant has to land on the primary too
 * - this lets a human type the short alias (`eero@`) and still hit the right
 * row (`eero.sahlberg@`).
 *
 * The Directory `GET /users/{userKey}` endpoint accepts an alias as the key and
 * answers with the account's `primaryEmail`. An address Workspace doesn't know
 * (404) falls back to itself, so off-domain grants and local testing still work.
 */
export async function resolveToPrimaryEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const token = await getGoogleAccessToken(SCOPES, requireEnv('GOOGLE_WORKSPACE_SUBJECT'));

  const url = `${DIRECTORY_URL}/users/${encodeURIComponent(normalized)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return normalized;
  if (!response.ok) {
    throw new Error(
      `Directory API /users/${normalized} failed (${response.status}): ${await response.text()}`,
    );
  }

  const user = (await response.json()) as DirectoryUser;
  return user.primaryEmail?.trim().toLowerCase() || normalized;
}
