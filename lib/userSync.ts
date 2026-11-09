import { deriveRole, type Role } from '@/lib/admin';
import type { WorkspaceMember } from '@/lib/googleWorkspace';

/**
 * Reconciles kontti's `User` table against the Google Workspace roster.
 *
 * Pure planner: takes an already-fetched roster plus the existing rows and
 * returns what to change, so the decision logic, the part that can lock people
 * out. It is testable without a network, a service-account key or a database.
 * `cron/syncWorkspaceUsers` pairs it with `fetchWorkspaceRoster` and applies it.
 *
 * ## What it does (mirrors klapi)
 *
 * - **creates** a row for an active member who has none, so the troop shows in
 *   `/admin/users` (with names) before first login. Role is `deriveRole(email)`
 *   (EVENT_ADMIN for a pitva-domain address, the same a sign-in grants).
 * - **renames** a row whose name drifted from the directory.
 * - **restores** a member the sync itself had deactivated (they came back).
 * - **deactivates** a member who is gone from Workspace. This is a soft-delete;
 *   `deletedAt` is stamped,
 *   from Workspace, suspended, archived, or out of the member group. Their row
 *   survives; `lib/auth.ts` refuses the sign-in while deactivated.
 *
 * Because access is gated by `deletedAt` (not by re-deriving the role at login),
 * a departed member stays out even though their pitva-domain address would
 * otherwise still derive EVENT_ADMIN.
 *
 * ## Guards (the destructive half is fenced three ways)
 *
 * - an empty active set aborts the whole run;
 * - a run that would deactivate more than `maxDeactivations` accounts aborts
 *   before a single write lands;
 * - the last live SUPERADMIN is never deactivated, so a bad roster read can't
 *   lock the troop out of its own admin panel.
 *
 * A row a human soft-deleted (`deletedBySync: false`) is left exactly as is:
 * never renamed, never auto-restored.
 */

export class UserSyncAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserSyncAbort';
  }
}

/** The existing-row shape the planner needs (a `prisma.user` projection). */
export type ExistingUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  deletedAt: Date | null;
  deletedBySync: boolean;
};

export type UserSyncPlan = {
  toCreate: { email: string; name: string | null; role: Role }[];
  toRename: { id: string; email: string; name: string }[];
  toRestore: { id: string; email: string }[];
  toDeactivate: { id: string; email: string }[];
  /** Governed, gone from the roster, but deliberately kept (last superadmin). */
  keptAlive: string[];
};

export type UserSyncOptions = {
  /**
   * Domain addresses to ignore entirely. These are robot accounts that are Workspace
   * users but not people (`admin@`, `pitvadev@`). They would otherwise be
   * provisioned, because the member group can carry a whole-organisation member
   * (see `fetchWorkspaceRoster`) that sweeps every domain user into it.
   */
  excludeEmails?: string[];
  /**
   * Circuit breaker: abort instead of deactivating more than this many accounts
   * in one run. A roster read that half-fails should page a human, not quietly
   * empty the user table.
   */
  maxDeactivations?: number;
};

const DEFAULT_MAX_DEACTIVATIONS = 10;

export function planWorkspaceSync(
  roster: WorkspaceMember[],
  existing: ExistingUser[],
  options: UserSyncOptions = {},
): UserSyncPlan {
  const { excludeEmails = [], maxDeactivations = DEFAULT_MAX_DEACTIVATIONS } = options;
  const excluded = new Set(excludeEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));

  const active = new Map(
    roster
      .filter((member) => member.active && !excluded.has(member.email.toLowerCase()))
      .map((member) => [member.email.toLowerCase(), member]),
  );

  // A roster with no active member is a failure, not an instruction to
  // deactivate everyone. (`fetchWorkspaceRoster` already throws on an empty API
  // response; this covers a non-empty roster with no *active* member.)
  if (active.size === 0) {
    throw new UserSyncAbort('Workspace roster contains no active members, refusing to sync');
  }

  const governed = existing.filter((user) => !excluded.has(user.email.toLowerCase()));
  const byEmail = new Map(governed.map((user) => [user.email.toLowerCase(), user]));
  const liveSupers = governed.filter(
    (user) => user.role === 'SUPERADMIN' && user.deletedAt === null,
  ).length;

  const plan: UserSyncPlan = {
    toCreate: [],
    toRename: [],
    toRestore: [],
    toDeactivate: [],
    keptAlive: [],
  };

  // --- Plan the deactivations first, so the circuit breaker aborts the run
  // --- before any write lands.
  const candidates = governed.filter(
    (user) => user.deletedAt === null && !active.has(user.email.toLowerCase()),
  );
  if (candidates.length > maxDeactivations) {
    throw new UserSyncAbort(
      `Refusing to deactivate ${candidates.length} accounts in one run ` +
        `(limit ${maxDeactivations}): ${candidates.map((user) => user.email).join(', ')}`,
    );
  }

  // --- Additive half: create, restore, rename.
  for (const [email, member] of active) {
    const current = byEmail.get(email);

    if (!current) {
      plan.toCreate.push({ email, name: member.name, role: deriveRole(email, null) });
      continue;
    }

    // A human's delete outranks the roster: leave it, and don't rename a row
    // nobody can sign into.
    if (current.deletedAt && !current.deletedBySync) continue;

    if (current.deletedAt) {
      plan.toRestore.push({ id: current.id, email });
    }

    if (member.name && member.name !== current.name) {
      plan.toRename.push({ id: current.id, email, name: member.name });
    }
  }

  // --- Destructive half: deactivate, keeping the last live superadmin.
  let remainingSupers = liveSupers;
  for (const user of candidates) {
    if (user.role === 'SUPERADMIN' && remainingSupers <= 1) {
      plan.keptAlive.push(user.email);
      continue;
    }
    if (user.role === 'SUPERADMIN') remainingSupers -= 1;
    plan.toDeactivate.push({ id: user.id, email: user.email });
  }

  return plan;
}
