// Admin authorization rules.
//
// Order of preference:
//   1. KAUPPA_ADMIN_EMAILS  — explicit comma-separated allowlist.
//   2. GOOGLE_WORKSPACE_DOMAIN — every sign-in from the troop's Workspace
//                                domain is an admin.
//   3. Neither set — every signed-in user is an admin. Meant for local dev;
//      do not deploy a store with both empty.

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const allowlist = (process.env.KAUPPA_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0) return allowlist.includes(normalized);
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase();
  if (domain) return normalized.endsWith(`@${domain}`);
  return true;
}

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.KAUPPA_DEV_LOGIN === '1';
}
