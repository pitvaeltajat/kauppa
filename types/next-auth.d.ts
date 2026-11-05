import { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      /** Which provider signed the user in, e.g. "google" or "dev-login". */
      provider?: string;
    } & DefaultSession['user'];
  }
}
