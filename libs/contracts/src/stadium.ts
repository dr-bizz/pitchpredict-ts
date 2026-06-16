import { stadiums } from '@pitchpredict/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const stadiumSchema = createSelectSchema(stadiums);
export type Stadium = z.infer<typeof stadiumSchema>;
