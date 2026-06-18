import { db, schema } from '@pitchpredict/db';
import type {
  FixtureResultInput,
  FixtureWithTeams,
  Stage,
  Status,
} from '@pitchpredict/contracts';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { scoreFixture } from './scoring';
import { NotFoundError } from '../errors';

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
