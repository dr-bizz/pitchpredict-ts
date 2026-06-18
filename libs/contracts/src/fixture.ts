import { fixtures } from '@pitchpredict/db/schema';
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
 * `locked` flag (kickoff passed, status no longer `scheduled`, or a team not yet
 * assigned). Used by the fixtures list / prediction cards. Knockout fixtures may
 * have null teams (TBD) until the admin assigns them, so `homeTeam`/`awayTeam`
 * are nullable; the underlying `homeTeamId`/`awayTeamId` are likewise nullable.
 */
export const fixtureWithTeamsSchema = fixtureSchema.extend({
  homeTeam: teamSchema.nullable(),
  awayTeam: teamSchema.nullable(),
  stadium: stadiumSchema,
  locked: z.boolean(),
});
export type FixtureWithTeams = z.infer<typeof fixtureWithTeamsSchema>;

/**
 * Body for the admin "assign knockout teams" action. Either id may be null to
 * leave/clear the slot as TBD; assigning requires two distinct existing teams
 * (enforced in the service).
 */
export const fixtureTeamsInputSchema = z.object({
  homeTeamId: z.number().int().nullable(),
  awayTeamId: z.number().int().nullable(),
});
export type FixtureTeamsInput = z.infer<typeof fixtureTeamsInputSchema>;

/**
 * Query string for `GET /fixtures`. `stage` is an optional `StageTab`; anything
 * absent/unknown is treated as `upcoming` by the service.
 */
export const fixtureQuerySchema = z.object({
  stage: z
    .enum([
      'upcoming',
      'group',
      'r32',
      'r16',
      'qf',
      'sf',
      'third_place',
      'final',
    ])
    .optional(),
});
export type FixtureQuery = z.infer<typeof fixtureQuerySchema>;

/**
 * Query string for the admin fixtures list. Both filters are optional; an
 * absent/unknown value means "all" (the service ignores it).
 */
export const adminFixtureQuerySchema = z.object({
  stage: zStage.optional(),
  status: zStatus.optional(),
});
export type AdminFixtureQuery = z.infer<typeof adminFixtureQuerySchema>;

/**
 * Body for entering a fixture result (admin). Scores are non-negative integers;
 * entering a result always finishes the fixture, so both are required.
 */
export const fixtureResultInputSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});
export type FixtureResultInput = z.infer<typeof fixtureResultInputSchema>;
