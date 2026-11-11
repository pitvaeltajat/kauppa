import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';
import { prisma } from '@/lib/prisma';
import { deriveRole, type Role } from '@/lib/admin';

// Local development only: a password-less sign-in on /login that takes any
// email. Mirrors Budu's BUDU_DEV_LOGIN. Ignored in production.
const devLoginEnabled = process.env.NODE_ENV !== 'production' && process.env.KAUPPA_DEV_LOGIN === '1';

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

function buildProviders(): Provider[] {
  const list: Provider[] = [];
  if (googleClientId && googleClientSecret) {
    list.push(
      Google({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      authorization: process.env.GOOGLE_WORKSPACE_DOMAIN
        ? { params: { hd: process.env.GOOGLE_WORKSPACE_DOMAIN } }
        : undefined,
      }),
    );
  }
  if (devLoginEnabled) {
    list.push(
      Credentials({
        id: 'dev-login',
        name: 'Kehitys',
        credentials: {
          email: { label: 'Sähköposti', type: 'email' },
        },
        async authorize(credentials) {
          const email =
            typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
          if (!email.includes('@')) return null;
          const devDomain = process.env.KAUPPA_DEV_DOMAIN?.trim().toLowerCase();
          const seedEmail = process.env.KAUPPA_SEED_EMAIL?.trim().toLowerCase();
          const allowed =
            (devDomain !== undefined && devDomain !== '' && email.endsWith(`@${devDomain}`)) ||
            (!devDomain && !seedEmail) ||
            (seedEmail !== undefined && seedEmail !== '' && email === seedEmail);
          if (!allowed) return null;
          return { id: email, email, name: email.split('@')[0] };
        },
      }),
    );
  }
  return list;
}

/**
 * Makes sure the signed-in person has a User row and the right role. The role
 * is re-derived from the email domain on every sign-in (pitva domain =>
 * EVENT_ADMIN), but a standing SUPERADMIN is preserved. The role is read back
 * so the JWT/session can carry it.
 */
async function ensureUser(email: string | null | undefined, name: string | null | undefined) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    const role = deriveRole(normalized, existing.role as Role);
    const nextName = name ?? existing.name ?? null;
    if (role !== existing.role || nextName !== existing.name) {
      return prisma.user.update({ where: { email: normalized }, data: { role, name: nextName } });
    }
    return existing;
  }
  return prisma.user.create({
    data: { email: normalized, name: name ?? email.split('@')[0], role: deriveRole(normalized, null) },
  });
}

export const authConfig: NextAuthConfig = {
  providers: buildProviders(),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  // Every deployment of this app (Vercel custom domain, localhost, self-hosted)
  // serves its own trusted host. Passing an explicit `false` on Vercel disabled
  // Auth.js's own host trust and made /api/auth/* throw UntrustedHost.
  trustHost: true,
  pages: { signIn: '/login' },
  // The shared .pitva.fi session cookie (landeri/klapi/budu). AUTH_SECRET must
  // then match the other apps. Leave unset locally to stay host-scoped.
  cookies: process.env.AUTH_COOKIE_DOMAIN
    ? {
        sessionToken: {
          options: { path: '/', domain: process.env.AUTH_COOKIE_DOMAIN },
        },
      }
    : undefined,
  callbacks: {
    // While the shop is "kesken" (WIP), only standing SUPERADMINs may sign in.
    // A pitva-domain address still *derives* EVENT_ADMIN, but that no longer
    // lets anyone in. The row has to already carry SUPERADMIN (set by
    // `pnpm db:admin` / the admin UI). A departed member (deletedAt, set by the
    // Workspace sync) is refused regardless. Blocking here, before `jwt`, also
    // stops `ensureUser` creating/resurrecting a row for a refused sign-in.
    // To open the shop to the whole troop later, drop the role check and keep
    // just the `deletedAt == null` guard.
    // Dev login is localhost-only and gates itself in `authorize()`, so it
    // bypasses this. Otherwise there'd be no way to test as a plain user.
    async signIn({ user, account }) {
      if (account?.provider === 'dev-login') return true;
      const email = user?.email?.trim().toLowerCase();
      if (!email) return false;
      const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase();
      if (!workspaceDomain || !email.endsWith(`@${workspaceDomain}`)) return false;
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { role: true, deletedAt: true },
      });
      return existing?.role === 'SUPERADMIN' && existing.deletedAt == null;
    },
    // `user` is only present on an actual sign-in, so the database write
    // happens once per person, not on every request.
    async jwt({ token, user, account }) {
      if (account) token.provider = account.provider;
      if (user?.email) {
        const dbUser = await ensureUser(user.email, user.name);
        token.email = user.email;
        token.name = user.name ?? token.name;
        token.role = dbUser?.role ?? 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.provider = typeof token.provider === 'string' ? token.provider : undefined;
        session.user.role = typeof token.role === 'string' ? token.role : undefined;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

