import { beforeAll, describe, expect, it } from 'vitest';
import { planWorkspaceSync, UserSyncAbort, type ExistingUser } from '@/lib/userSync';
import type { Role } from '@/lib/admin';
import type { WorkspaceMember } from '@/lib/googleWorkspace';

const DOMAIN = 'pitkajarvenvaeltajat.fi';

// deriveRole() (used for the created role) reads the domain from the env.
beforeAll(() => {
  process.env.GOOGLE_WORKSPACE_DOMAIN = DOMAIN;
});

const member = (email: string, name: string | null, active = true): WorkspaceMember => ({
  email,
  name,
  active,
});

let seq = 0;
const row = (email: string, over: Partial<ExistingUser> = {}): ExistingUser => ({
  id: `id${seq++}`,
  email,
  name: null,
  role: 'EVENT_ADMIN' as Role,
  deletedAt: null,
  deletedBySync: false,
  ...over,
});

describe('planWorkspaceSync', () => {
  it('creates missing active members as EVENT_ADMIN, renames drift, ignores inactive', () => {
    const roster = [
      member(`a@${DOMAIN}`, 'Aino A'), // new → create
      member(`b@${DOMAIN}`, 'Bertta B'), // existing, name drifted → rename
      member(`c@${DOMAIN}`, 'Cecil C'), // existing, same name → nothing
      member(`d@${DOMAIN}`, 'Doris D', false), // inactive & no row → ignored
    ];
    const existing = [
      row(`b@${DOMAIN}`, { name: 'Old Name' }),
      row(`c@${DOMAIN}`, { name: 'Cecil C' }),
    ];

    const plan = planWorkspaceSync(roster, existing);

    expect(plan.toCreate).toEqual([{ email: `a@${DOMAIN}`, name: 'Aino A', role: 'EVENT_ADMIN' }]);
    expect(plan.toRename).toEqual([{ id: existing[0].id, email: `b@${DOMAIN}`, name: 'Bertta B' }]);
    expect(plan.toDeactivate).toEqual([]);
  });

  it('deactivates a governed member who left the roster', () => {
    const roster = [member(`a@${DOMAIN}`, 'Aino A')];
    const existing = [row(`a@${DOMAIN}`, { name: 'Aino A' }), row(`gone@${DOMAIN}`)];
    const plan = planWorkspaceSync(roster, existing);
    expect(plan.toDeactivate).toEqual([{ id: existing[1].id, email: `gone@${DOMAIN}` }]);
  });

  it('restores a member the sync had deactivated but leaves a hand-deletion alone', () => {
    const roster = [member(`back@${DOMAIN}`, 'Back B'), member(`hand@${DOMAIN}`, 'Hand H')];
    const existing = [
      row(`back@${DOMAIN}`, { name: 'Back B', deletedAt: new Date(), deletedBySync: true }),
      row(`hand@${DOMAIN}`, { name: 'Hand H', deletedAt: new Date(), deletedBySync: false }),
    ];
    const plan = planWorkspaceSync(roster, existing);
    expect(plan.toRestore).toEqual([{ id: existing[0].id, email: `back@${DOMAIN}` }]);
    // hand-deleted: not restored, not renamed, not re-created.
    expect(plan.toCreate).toEqual([]);
    expect(plan.toRename).toEqual([]);
  });

  it('never deactivates the last live superadmin', () => {
    const roster = [member(`a@${DOMAIN}`, 'Aino A')]; // superadmin not in roster
    const existing = [
      row(`a@${DOMAIN}`, { name: 'Aino A' }),
      row(`boss@${DOMAIN}`, { role: 'SUPERADMIN' }),
    ];
    const plan = planWorkspaceSync(roster, existing);
    expect(plan.toDeactivate).toEqual([]);
    expect(plan.keptAlive).toEqual([`boss@${DOMAIN}`]);
  });

  it('aborts before writing when the run exceeds maxDeactivations', () => {
    const roster = [member(`a@${DOMAIN}`, 'Aino A')];
    const existing = [
      row(`a@${DOMAIN}`, { name: 'Aino A' }),
      row(`x@${DOMAIN}`),
      row(`y@${DOMAIN}`),
    ];
    expect(() => planWorkspaceSync(roster, existing, { maxDeactivations: 1 })).toThrow(UserSyncAbort);
  });

  it('skips excluded robot accounts (neither created nor deactivated)', () => {
    const roster = [member(`eero@${DOMAIN}`, 'Eero E')];
    const existing = [row(`admin@${DOMAIN}`, { name: 'Robot' })];
    const plan = planWorkspaceSync(roster, existing, { excludeEmails: [`admin@${DOMAIN}`] });
    expect(plan.toCreate.map((c) => c.email)).toEqual([`eero@${DOMAIN}`]);
    expect(plan.toDeactivate).toEqual([]);
  });

  it('aborts rather than treating an empty active roster as "no members"', () => {
    const roster = [member(`x@${DOMAIN}`, 'X', false)];
    expect(() => planWorkspaceSync(roster, [])).toThrow(UserSyncAbort);
  });
});
