/**
 * Framework-free lock rules shared by predictions and champion picks. Mirrors the
 * Rails `Fixture#locked?` / tournament-start checks so the BFF, services and seed
 * all agree on when a pick can still change.
 */

/**
 * Champion picks lock at a fixed wall-clock deadline rather than the first
 * kickoff. `2026-06-20T22:00:00Z` is Sat Jun 20 2026, 6:00 PM US Eastern (EDT,
 * UTC-4).
 */
export const CHAMPION_PICK_DEADLINE = new Date('2026-06-20T22:00:00Z');

/**
 * A prediction is locked once the match has kicked off (`kickoffAt <= now`), it
 * is no longer `scheduled` (i.e. live or finished), or a team is not yet
 * assigned (knockout fixtures are TBD until the admin sets both teams). Open
 * otherwise. `homeTeamId`/`awayTeamId` are optional so existing callers that
 * only pass kickoff/status keep working.
 */
export function isFixtureLocked(
  f: {
    kickoffAt: Date;
    status: string;
    homeTeamId?: number | null;
    awayTeamId?: number | null;
  },
  now: Date = new Date()
): boolean {
  return (
    f.kickoffAt <= now ||
    f.status !== 'scheduled' ||
    f.homeTeamId == null ||
    f.awayTeamId == null
  );
}

/**
 * Champion picks are locked once the fixed deadline has passed (`now >=
 * deadline`). No DB query needed.
 */
export function championPicksLocked(
  now: Date = new Date(),
  deadline: Date = CHAMPION_PICK_DEADLINE
): boolean {
  return now >= deadline;
}
