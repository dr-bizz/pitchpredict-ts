import { db, schema } from '@pitchpredict/db';
import type { Prediction, PredictionInput } from '@pitchpredict/contracts';
import { eq } from 'drizzle-orm';
import { isFixtureLocked } from '../domain/fixture-rules';
import { BusinessError, NotFoundError } from '../errors';

/**
 * Upsert the caller's prediction for a fixture (keyed on userId + fixtureId).
 * Rejects with 422 when the fixture is locked, matching the Rails copy. Mirrors
 * the singular-resource upsert from `PredictionsController`.
 */
export async function upsert(
  userId: number,
  fixtureId: number,
  input: PredictionInput,
  now: Date = new Date()
): Promise<Prediction> {
  const fixture = await db.query.fixtures.findFirst({
    where: eq(schema.fixtures.id, fixtureId),
  });
  if (!fixture) {
    throw new NotFoundError(`Fixture ${fixtureId} not found`);
  }
  if (
    isFixtureLocked(
      {
        kickoffAt: fixture.kickoffAt,
        status: fixture.status,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
      },
      now
    )
  ) {
    throw new BusinessError('Predictions are locked for this match');
  }

  const [row] = await db
    .insert(schema.predictions)
    .values({
      userId,
      fixtureId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
    })
    .onConflictDoUpdate({
      target: [schema.predictions.userId, schema.predictions.fixtureId],
      set: {
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}
