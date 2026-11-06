import type { Metadata } from 'next';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { Shield, ShieldCheck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { deriveRole, type Role } from '@/lib/admin';
import { setUserRole } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Käyttäjät' };

const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Pääylläpitäjä',
  EVENT_ADMIN: 'Tapahtumavastaava',
  USER: 'Käyttäjä',
};

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const session = await auth();
  const myEmail = session?.user?.email?.trim().toLowerCase();

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Käyttäjät</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tapahtumavastaavan roolin saa automaattisesti jokainen pitva-tunnuksella kirjautuva.
          Pääylläpitäjän (täydet oikeudet) nimittää vain toinen pääylläpitäjä täältä. Ensimmäinen
          luodaan seed-komennolla (KAUPPA_BOOTSTRAP_ADMIN_EMAILS) tai <code>pnpm db:admin sähköposti</code>.
        </p>
      </div>

      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei käyttäjiä vielä. Käyttäjä luodaan automaattisesti ensimmäisellä kirjautumisella.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Sähköposti</th>
                <th className="px-4 py-3">Nimi</th>
                <th className="px-4 py-3">Rooli</th>
                <th className="px-4 py-3">Rekisteröitynyt</th>
                <th className="px-4 py-3 text-right">Toiminnot</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isMe = user.email === myEmail;
                const role = user.role as Role;
                const isSuper = role === 'SUPERADMIN';
                // Demoting a superadmin drops them back to their derived role.
                const demoteTo = deriveRole(user.email, null);
                return (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {user.email}
                      {isMe && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(tämä tili)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {isSuper ? (
                        <Badge className="gap-1">
                          <ShieldCheck className="size-3" /> {ROLE_LABEL.SUPERADMIN}
                        </Badge>
                      ) : role === 'EVENT_ADMIN' ? (
                        <Badge variant="warning" className="gap-1">
                          <Shield className="size-3" /> {ROLE_LABEL.EVENT_ADMIN}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{ROLE_LABEL.USER}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(user.createdAt, 'd.M.yyyy', { locale: fi })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {!isMe && (
                          <form action={setUserRole}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="role" value={isSuper ? demoteTo : 'SUPERADMIN'} />
                            <Button type="submit" size="sm" variant={isSuper ? 'ghost' : 'outline'}>
                              {isSuper ? 'Poista pääylläpito' : 'Tee pääylläpitäjäksi'}
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
