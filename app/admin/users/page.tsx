import type { Metadata } from 'next';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { Shield } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { setUserRole } from '@/lib/actions/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Käyttäjät' };

export default async function AdminUsersPage() {
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
          Ylläpitäjyys on tietokannassa: tili saa ADMIN-roolin täältä. Ensimmäinen ylläpitäjä
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
                      {user.role === 'ADMIN' ? (
                        <Badge className="gap-1">
                          <Shield className="size-3" /> Ylläpitäjä
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Käyttäjä</Badge>
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
                            <input
                              type="hidden"
                              name="role"
                              value={user.role === 'ADMIN' ? 'USER' : 'ADMIN'}
                            />
                            <Button type="submit" size="sm" variant={user.role === 'ADMIN' ? 'ghost' : 'outline'}>
                              {user.role === 'ADMIN' ? 'Poista ylläpito' : 'Tee ylläpitäjäksi'}
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
