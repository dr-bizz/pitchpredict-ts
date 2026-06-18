import { db, schema } from '@pitchpredict/db';
import type {
  FixtureWithTeams,
  Prediction,
  Stage,
} from '@pitchpredict/contracts';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { isFixtureLocked } from '../domain/fixture-rules';

/** A fixture row joined with its teams + stadium, before `locked` is computed. */
type FixtureWithRelations = typeof schema.fixtures.$inferSelect & {
  homeTeam: typeof schema.teams.$inferSelect;
  awayTeam: typeof schema.teams.$inferSelect;
  stadium: typeof schema.stadiums.$inferSelect;
};

/** A group of fixtures under a heading (a date for `upcoming`, a group for the group stage). */
export interface FixtureGroup {
  label: string;
  fixtures: FixtureWithTeams[];
}

/** The `GET /fixtures` payload: the resolved stage, grouped fixtures, caller predictions. */
export interface FixturesResponse {
  stage: string;
  groups: FixtureGroup[];
  /** Caller's predictions keyed by fixtureId, for prefilling the cards. */
  predictionsByFixtureId: Record<number, Prediction>;
}

/**
 * List fixtures for the predictions grid. `upcoming` (default) lists future
 * scheduled fixtures in kickoff order grouped by date; a concrete stage lists
 * that stage in kickoff order (group stage additionally grouped by group name).
 * Mirrors the Rails `FixturesController#index`.
 */
export async function list(
  stage: string | undefined,
  userId: number,
  now: Date = new Date()
): Promise<FixturesResponse> {
  const resolvedStage = resolveStage(stage);

  const rows: FixtureWithRelations[] =
    resolvedStage === 'upcoming'
      ? await db.query.fixtures.findMany({
          where: and(
            eq(schema.fixtures.status, 'scheduled'),
            gt(schema.fixtures.kickoffAt, now)
          ),
          orderBy: asc(schema.fixtures.kickoffAt),
          with: { homeTeam: true, awayTeam: true, stadium: true },
        })
      : await db.query.fixtures.findMany({
          where: eq(schema.fixtures.stage, resolvedStage as Stage),
          orderBy: asc(schema.fixtures.kickoffAt),
          with: { homeTeam: true, awayTeam: true, stadium: true },
        });

  const fixtures = rows.map((row) => withLocked(row, now));
  const groups =
    resolvedStage === 'upcoming'
      ? groupByDate(fixtures)
      : resolvedStage === 'group'
      ? groupByGroupName(fixtures)
      : [{ label: '', fixtures }];

  const predictionsByFixtureId = await callerPredictions(
    userId,
    rows.map((r) => r.id)
  );

  return { stage: resolvedStage, groups, predictionsByFixtureId };
}

function resolveStage(stage: string | undefined): string {
  const tabs = [
    'upcoming',
    'group',
    'r32',
    'r16',
    'qf',
    'sf',
    'third_place',
    'final',
  ];
  return stage && tabs.includes(stage) ? stage : 'upcoming';
}

function withLocked(
  row: FixtureWithRelations,
  now: Date
): FixtureWithTeams {
  return {
    ...row,
    locked: isFixtureLocked(
      { kickoffAt: row.kickoffAt, status: row.status },
      now
    ),
  };
}

/** Ordered groups keyed by the kickoff date (ISO yyyy-mm-dd). Input is kickoff-ascending. */
function groupByDate(fixtures: FixtureWithTeams[]): FixtureGroup[] {
  const groups: FixtureGroup[] = [];
  for (const fixture of fixtures) {
    const label = fixture.kickoffAt.toISOString().slice(0, 10);
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.fixtures.push(fixture);
    } else {
      groups.push({ label, fixtures: [fixture] });
    }
  }
  return groups;
}

/**
 * Ordered groups keyed by the home team's group name (assumption mirrored from
 * Rails: group-stage fixtures always pair same-group teams), sorted by label.
 */
function groupByGroupName(fixtures: FixtureWithTeams[]): FixtureGroup[] {
  const groups: FixtureGroup[] = [];
  for (const fixture of fixtures) {
    const label = fixture.homeTeam.groupName;
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.fixtures.push(fixture);
    } else {
      groups.push({ label, fixtures: [fixture] });
    }
  }
  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

async function callerPredictions(
  userId: number,
  fixtureIds: number[]
): Promise<Record<number, Prediction>> {
  if (fixtureIds.length === 0) {
    return {};
  }
  const rows = await db.query.predictions.findMany({
    where: and(
      eq(schema.predictions.userId, userId),
      inArray(schema.predictions.fixtureId, fixtureIds)
    ),
  });
  const map: Record<number, Prediction> = {};
  for (const row of rows) {
    map[row.fixtureId] = row;
  }
  return map;
}
