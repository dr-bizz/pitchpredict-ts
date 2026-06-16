import { championPicks } from '@pitchpredict/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const championPickSchema = createSelectSchema(championPicks);
export type ChampionPick = z.infer<typeof championPickSchema>;

/** Body for selecting a champion team. */
export const championPickInputSchema = z.object({
  teamId: z.number().int().positive(),
});
export type ChampionPickInput = z.infer<typeof championPickInputSchema>;
