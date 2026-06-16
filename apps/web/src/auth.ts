import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

/**
 * NextAuth v5 (Credentials). `authorize` delegates password verification to the
 * Nest API (`POST /auth/login`); the session uses the stateless `jwt` strategy
 * and carries the user's `id` + `role`, which the BFF turns into an RS256 API
 * token.
 *
 * NOTE: this module runs in the Edge middleware, so it deliberately avoids the
 * `@pitchpredict/contracts` barrel (which pulls the Drizzle/postgres client).
 * The login response is validated with a tiny local schema instead.
 */

const loginUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['player', 'admin']),
});

function apiUrl(): string {
  return process.env['API_URL'] ?? 'http://localhost:3334';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const res = await fetch(`${apiUrl()}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          return null;
        }

        const parsed = loginUserSchema.safeParse(await res.json());
        if (!parsed.success) {
          return null;
        }
        const user = parsed.data;
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
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
        session.user.id = token.id;
      }
      if (token.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },
});
