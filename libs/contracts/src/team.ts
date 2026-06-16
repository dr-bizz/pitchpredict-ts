import { teams } from '@pitchpredict/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/** Three uppercase letters, e.g. `BRA`, `GER`. */
export const teamCodeRegex = /^[A-Z]{3}$/;

export const teamSchema = createSelectSchema(teams, {
  code: (schema) => schema.code.regex(teamCodeRegex),
});
export type Team = z.infer<typeof teamSchema>;
