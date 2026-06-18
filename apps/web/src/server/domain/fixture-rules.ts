/**
 * Framework-free lock rules shared by predictions and champion picks. Mirrors the
 * Rails `Fixture#locked?` / tournament-start checks so the BFF, services and seed
 * all agree on when a pick can still change.
 */

/**
 * A prediction is locked once the match has kicked off (`kickoffAt <= now`) or it
 * is no longer `scheduled` (i.e. live or finished). Open otherwise.
 */
export function isFixtureLocked(
  f: { kickoffAt: Date; status: string },
  now: Date = new Date()
): boolean {
  return f.kickoffAt <= now || f.status !== 'scheduled';
}

/**
 * The tournament has started once the earliest fixture's kickoff has passed. Used
 * to lock champion picks. `null` (no fixtures) means it has not started.
 */
export function tournamentStarted(
  earliestKickoff: Date | null,
  now: Date = new Date()
): boolean {
  return !!earliestKickoff && earliestKickoff <= now;
}
