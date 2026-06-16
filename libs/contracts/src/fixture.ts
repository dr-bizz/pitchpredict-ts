import { fixtures } from '@pitchpredict/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { zStage, zStatus } from './enums';
import { stadiumSchema } from './stadium';
import { teamSchema } from './team';

export const fixtureSchema = createSelectSchema(fixtures, {
  stage: zStage,
  status: zStatus,
});
export type Fixture = z.infer<typeof fixtureSchema>;

/**
 * A fixture with its related teams and stadium embedded, plus the computed
 * `locked` flag (kickoff passed or status no longer `scheduled`). Used by the
 * fixtures list / prediction cards.
 */
export const fixtureWithTeamsSchema = fixtureSchema.extend({
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  stadium: stadiumSchema,
  locked: z.boolean(),
});
export type FixtureWithTeams = z.infer<typeof fixtureWithTeamsSchema>;
