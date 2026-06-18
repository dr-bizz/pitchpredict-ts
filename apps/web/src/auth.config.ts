import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config. This module is imported by middleware.ts which
 * runs on the Edge runtime, so it MUST NOT import @pitchpredict/db, bcrypt, or
 * any Node-only module. The Credentials provider (which needs db + bcrypt) lives
 * only in auth.ts.
 */
const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.role) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

export default authConfig;
