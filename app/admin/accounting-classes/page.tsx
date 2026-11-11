import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { deleteAccountingClass } from '@/lib/actions/admin';
import { AccountingClassForm } from '@/components/admin/accounting-class-form';
import { FormButton } from '@/components/admin/form-button';

export const metadata: Metadata = { title: 'Kirjanpitoluokat' };

export default async function AccountingClassesPage() {
  await requireSuperAdmin();
  const classes = await prisma.accountingClass.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true, kammiBookings: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kirjanpitoluokat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sisäinen luokittelu tuotteille, tapahtumille ja Kammin varauksille.</p>
      </div>
      <AccountingClassForm />
      <div className="space-y-3">
        {classes.length === 0 && <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">Kirjanpitoluokkia ei ole vielä.</p>}
        {classes.map((accountingClass) => {
          const used = accountingClass._count.items + accountingClass._count.kammiBookings;
          return (
            <div key={accountingClass.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
              <div><p className="font-semibold">{accountingClass.name}</p><p className="text-xs text-muted-foreground">Järjestys {accountingClass.sortOrder} · käytössä {used} kohteessa</p></div>
              <form action={deleteAccountingClass}>
                <input type="hidden" name="id" value={accountingClass.id} />
                <FormButton size="sm" variant="ghost" disabled={used > 0} title={used > 0 ? 'Käytössä olevaa luokkaa ei voi poistaa.' : 'Poista luokka'} confirm={`Poistetaanko kirjanpitoluokka "${accountingClass.name}"?`}>Poista</FormButton>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
