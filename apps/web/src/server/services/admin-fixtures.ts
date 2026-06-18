import { db, schema } from '@pitchpredict/db';
import type {
  FixtureResultInput,
  FixtureTeamsInput,
  FixtureWithTeams,
  Stage,
  Status,
  Team,
} from '@pitchpredict/contracts';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import { scoreFixture } from './scoring';
import { BusinessError, NotFoundError } from '../errors';

/**
 * Admin fixtures list, optionally filtered by stage/status, ordered by status
 * (scheduled → live → finished, the pg enum declaration order) then kickoff so
 * the next match to settle is on top. Mirrors `Admin::FixturesController#index`.
 */
export async function list(
  stage?: Stage,
  status?: Status
): Promise<FixtureWithTeams[]> {
  const conditions: SQL[] = [];
  if (stage) {
    conditions.push(eq(schema.fixtures.stage, stage));
  }
  if (status) {
    conditions.push(eq(schema.fixtures.status, status));
  }

  const rows = await db.query.fixtures.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [asc(schema.fixtures.status), asc(schema.fixtures.kickoffAt)],
    with: { homeTeam: true, awayTeam: true, stadium: true },
  });

  return rows.map((row) => ({
    ...row,
    // The admin view never gates on lock; surface the real status instead.
    locked: row.status !== 'scheduled',
  }));
}

/**
 * Full team catalog (all 48), ordered by name, for admin knockout assignment.
 * Unlike the dashboard's team list this is never suppressed after the
 * champion-pick deadline — knockout assignment happens once groups conclude,
 * which is after that deadline.
 */
export async function listTeams(): Promise<Team[]> {
  return db.query.teams.findMany({ orderBy: asc(schema.teams.name) });
}

/**
 * Enter a result: mark the fixture finished, persist scores, then rescore its
 * predictions synchronously. Mirrors `Admin::FixturesController#update` (the
 * Rails version enqueues a job; here scoring runs inline per the plan).
 */
export async function enterResult(
  fixtureId: number,
  input: FixtureResultInput
): Promise<FixtureWithTeams> {
  const existing = await db.query.fixtures.findFirst({
    where: eq(schema.fixtures.id, fixtureId),
  });
  if (!existing) {
    throw new NotFoundError(`Fixture ${fixtureId} not found`);
  }

  await db
    .update(schema.fixtures)
    .set({
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      status: 'finished',
      updatedAt: new Date(),
    })
    .where(eq(schema.fixtures.id, fixtureId));

  await scoreFixture(fixtureId);

  const updated = await db.query.fixtures.findFirst({
    where: eq(schema.fixtures.id, fixtureId),
    with: { homeTeam: true, awayTeam: true, stadium: true },
  });
  if (!updated) {
    throw new NotFoundError(`Fixture ${fixtureId} not found`);
  }
  return { ...updated, locked: true };
}

/**
 * Assign (or clear) the two teams of a knockout fixture as groups conclude.
 * Group-stage fixtures keep their seeded teams and are rejected. Either id may
 * be null to leave the slot TBD; when both are set they must be distinct and
 * reference existing teams. Kickoff/stadium are untouched (see design notes).
 */
export async function assignTeams(
  fixtureId: number,
  input: FixtureTeamsInput
): Promise<FixtureWithTeams> {
  const existing = await db.query.fixtures.findFirst({
    where: eq(schema.fixtures.id, fixtureId),
  });
  if (!existing) {
    throw new NotFoundError(`Fixture ${fixtureId} not found`);
  }
  if (existing.stage === 'group') {
    throw new BusinessError('Group-stage fixtures cannot have their teams reassigned');
  }

  const { homeTeamId, awayTeamId } = input;
  if (homeTeamId != null && awayTeamId != null && homeTeamId === awayTeamId) {
    throw new BusinessError('Home and away teams must be different');
  }
  // Validate every provided id independently so a one-sided assignment with a
  // bogus id is rejected with a clean 422 rather than a raw FK error.
  const providedIds = [homeTeamId, awayTeamId].filter(
    (id): id is number => id != null
  );
  if (providedIds.length > 0) {
    const teams = await db.query.teams.findMany({
      where: inArray(schema.teams.id, providedIds),
      columns: { id: true },
    });
    if (teams.length !== providedIds.length) {
      throw new BusinessError('Teams must reference existing teams');
    }
  }

  await db
    .update(schema.fixtures)
    .set({ homeTeamId, awayTeamId, updatedAt: new Date() })
    .where(eq(schema.fixtures.id, fixtureId));

  const updated = await db.query.fixtures.findFirst({
    where: eq(schema.fixtures.id, fixtureId),
    with: { homeTeam: true, awayTeam: true, stadium: true },
  });
  if (!updated) {
    throw new NotFoundError(`Fixture ${fixtureId} not found`);
  }
  // Consistent with the admin list: gate on real status, not pick lock.
  return { ...updated, locked: updated.status !== 'scheduled' };
}
