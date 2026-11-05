import { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      /** Which provider signed the user in, e.g. "google" or "dev-login". */
      provider?: string;
      /** Role from the User row in the database ("ADMIN" | "USER"). */
      role?: string;
    } & DefaultSession['user'];
  }
}
