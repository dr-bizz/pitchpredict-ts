import { users } from '@pitchpredict/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { zRole } from './enums';

/**
 * Public user shape. Deliberately omits `passwordHash` and timestamps — this is
 * what the API exposes to clients and what NextAuth carries in the session.
 */
export const userSchema = createSelectSchema(users, {
  email: (schema) => schema.email.email(),
  role: zRole,
}).pick({
  id: true,
  name: true,
  email: true,
  role: true,
});
export type User = z.infer<typeof userSchema>;
