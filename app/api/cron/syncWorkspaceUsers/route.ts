import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchWorkspaceRoster } from '@/lib/googleWorkspace';
import { planWorkspaceSync, UserSyncAbort } from '@/lib/userSync';

export const dynamic = 'force-dynamic';

/**
 * Nightly Google Workspace → kontti user sync (scheduled in vercel.json).
 * Provisions a `User` row for every current troop member, keeps their names
 * current, and soft-deletes anyone who left the member group (restoring them if
 * they return), so a departed member loses sign-in on their own. See
 * `lib/userSync` for the reconcile rules and guards.
 *
 * Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET` automatically.
 * `?dryRun=1` reports what a run would change without writing:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://kontti.pitva.fi/api/cron/syncWorkspaceUsers?dryRun=1"
 */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

  try {
    const roster = await fetchWorkspaceRoster();
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN!;

    const existing = await prisma.user.findMany({
      where: { email: { endsWith: `@${domain}`, mode: 'insensitive' } },
      select: { id: true, email: true, name: true, role: true, deletedAt: true, deletedBySync: true },
    });

    const plan = planWorkspaceSync(roster, existing, {
      excludeEmails: (process.env.GOOGLE_WORKSPACE_EXCLUDE ?? '').split(','),
      maxDeactivations: process.env.WORKSPACE_SYNC_MAX_DEACTIVATIONS
        ? Number(process.env.WORKSPACE_SYNC_MAX_DEACTIVATIONS)
        : undefined,
    });

    if (!dryRun) {
      if (plan.toCreate.length > 0) {
        // skipDuplicates: a JIT sign-in may have created a row since the read.
        await prisma.user.createMany({ data: plan.toCreate, skipDuplicates: true });
      }
      for (const { id } of plan.toRestore) {
        await prisma.user.update({ where: { id }, data: { deletedAt: null, deletedBySync: false } });
      }
      for (const { id, name } of plan.toRename) {
        await prisma.user.update({ where: { id }, data: { name } });
      }
      for (const { id } of plan.toDeactivate) {
        await prisma.user.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date(), deletedBySync: true },
        });
      }
    }

    console.log(
      `Workspace sync${dryRun ? ' (dry run)' : ''}: ` +
        `${roster.filter((m) => m.active).length} active member(s), ` +
        `created ${plan.toCreate.length}, renamed ${plan.toRename.length}, ` +
        `restored ${plan.toRestore.length}, deactivated ${plan.toDeactivate.length}` +
        (plan.keptAlive.length ? `, kept last superadmin ${plan.keptAlive.join(', ')}` : ''),
    );

    return NextResponse.json({
      message: 'Workspace user sync completed',
      rosterSize: roster.length,
      activeMembers: roster.filter((m) => m.active).length,
      created: plan.toCreate.map((c) => c.email),
      renamed: plan.toRename.map((r) => r.email),
      restored: plan.toRestore.map((r) => r.email),
      deactivated: plan.toDeactivate.map((d) => d.email),
      keptAlive: plan.keptAlive,
      dryRun,
    });
  } catch (error) {
    if (error instanceof UserSyncAbort) {
      console.error('Workspace sync aborted:', error.message);
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error('Workspace user sync error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to sync Workspace users' },
      { status: 500 },
    );
  }
}
