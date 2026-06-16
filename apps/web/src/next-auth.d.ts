import 'next-auth';
import 'next-auth/jwt';
import type { DefaultSession } from 'next-auth';

/** Module augmentations exposing the user `id` + `role` on the session/token. */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}
