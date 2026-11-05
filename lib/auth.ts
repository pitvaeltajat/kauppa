import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';

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

export const authConfig: NextAuthConfig = {
  providers: buildProviders(),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  // Browserless hosts (localhost, self-hosted) are trusted when the app is not
  // on Vercel; on Vercel the platform host is trusted automatically.
  trustHost: !process.env.VERCEL,
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
    async jwt({ token, user, account }) {
      if (account) token.provider = account.provider;
      if (user) {
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.provider = typeof token.provider === 'string' ? token.provider : undefined;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
