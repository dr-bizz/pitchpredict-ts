import type { stageEnum } from '../enums';

/** Tournament stage union, inferred from the Drizzle pg enum. */
type Stage = (typeof stageEnum.enumValues)[number];

/**
 * The real World Cup 2026 group-stage schedule plus an illustrative knockout
 * bracket. Ported from the Rails seed (`group_schedule` + the knockout loops).
 *
 * Kickoffs in the Rails seed are built with `Time.zone.local(...)` in Eastern
 * time (the app's display zone). The tournament runs in June/July, so Eastern is
 * EDT = UTC-04:00. We encode every kickoff as an explicit ET wall-clock time
 * with the `-04:00` offset so the resulting `Date` is unambiguous regardless of
 * the machine's local zone.
 */

/** A team code (group stage) or a bracket slot index (knockout placeholders). */
type FixtureSpecKind =
  | { home: string; away: string } // group stage: team codes
  | { homeSlot: number; awaySlot: number }; // knockout: indices into bracket

export interface FixtureSpec {
  ref: FixtureSpecKind;
  stadiumIdx: number;
  /** Kickoff as an absolute instant (ET wall-clock encoded with -04:00). */
  kickoffAt: Date;
  stage: Stage;
}

/** Build a Date from ET wall-clock (June/July 2026 → EDT, UTC-04:00). */
function etKickoff(
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');
  return new Date(`2026-${mm}-${dd}T${hh}:${mi}:00-04:00`);
}

// Group stage: [homeCode, awayCode, [month, day, hour, minute] ET, stadiumIdx].
// Stadium indices match the STADIUMS array.
const GROUP_SCHEDULE: ReadonlyArray<
  readonly [string, string, readonly [number, number, number, number], number]
> = [
  // Group A
  ['MEX', 'RSA', [6, 11, 15, 0], 0],
  ['KOR', 'CZE', [6, 11, 20, 0], 1],
  ['CZE', 'RSA', [6, 18, 12, 0], 9],
  ['MEX', 'KOR', [6, 18, 23, 0], 1],
  ['MEX', 'CZE', [6, 24, 21, 0], 0],
  ['RSA', 'KOR', [6, 24, 21, 0], 2],
  // Group B
  ['CAN', 'BIH', [6, 12, 18, 0], 3],
  ['SUI', 'QAT', [6, 13, 15, 0], 13],
  ['CAN', 'QAT', [6, 18, 18, 0], 4],
  ['BIH', 'SUI', [6, 18, 15, 0], 6],
  ['SUI', 'CAN', [6, 24, 15, 0], 4],
  ['QAT', 'BIH', [6, 24, 15, 0], 12],
  // Group C
  ['BRA', 'MAR', [6, 13, 18, 0], 5],
  ['HAI', 'SCO', [6, 13, 15, 0], 14],
  ['BRA', 'HAI', [6, 19, 21, 0], 11],
  ['SCO', 'MAR', [6, 19, 18, 0], 14],
  ['SCO', 'BRA', [6, 24, 18, 0], 10],
  ['MAR', 'HAI', [6, 24, 18, 0], 9],
  // Group D
  ['USA', 'PAR', [6, 12, 21, 0], 6],
  ['AUS', 'TUR', [6, 13, 21, 0], 4],
  ['USA', 'AUS', [6, 19, 15, 0], 12],
  ['TUR', 'PAR', [6, 19, 22, 0], 13],
  ['TUR', 'USA', [6, 25, 22, 0], 6],
  ['PAR', 'AUS', [6, 25, 22, 0], 13],
  // Group E
  ['GER', 'CUW', [6, 14, 15, 0], 8],
  ['CIV', 'ECU', [6, 14, 19, 0], 11],
  ['GER', 'CIV', [6, 20, 16, 0], 3],
  ['ECU', 'CUW', [6, 20, 20, 0], 15],
  ['ECU', 'GER', [6, 25, 16, 0], 5],
  ['CUW', 'CIV', [6, 25, 16, 0], 11],
  // Group F
  ['NED', 'JPN', [6, 14, 16, 0], 7],
  ['SWE', 'TUN', [6, 14, 22, 0], 2],
  ['NED', 'SWE', [6, 20, 13, 0], 8],
  ['TUN', 'JPN', [6, 20, 22, 0], 2],
  ['JPN', 'SWE', [6, 25, 19, 0], 7],
  ['TUN', 'NED', [6, 25, 19, 0], 15],
  // Group G
  ['BEL', 'EGY', [6, 15, 18, 0], 12],
  ['IRN', 'NZL', [6, 15, 21, 0], 6],
  ['BEL', 'IRN', [6, 21, 15, 0], 6],
  ['NZL', 'EGY', [6, 21, 21, 0], 4],
  ['EGY', 'IRN', [6, 26, 23, 0], 12],
  ['NZL', 'BEL', [6, 26, 23, 0], 4],
  // Group H
  ['ESP', 'CPV', [6, 15, 12, 0], 9],
  ['KSA', 'URU', [6, 15, 18, 0], 10],
  ['ESP', 'KSA', [6, 21, 12, 0], 9],
  ['URU', 'CPV', [6, 21, 18, 0], 10],
  ['CPV', 'KSA', [6, 26, 20, 0], 8],
  ['URU', 'ESP', [6, 26, 20, 0], 1],
  // Group I
  ['FRA', 'SEN', [6, 16, 15, 0], 5],
  ['IRQ', 'NOR', [6, 16, 18, 0], 14],
  ['FRA', 'IRQ', [6, 22, 17, 0], 11],
  ['NOR', 'SEN', [6, 22, 20, 0], 5],
  ['NOR', 'FRA', [6, 26, 15, 0], 14],
  ['SEN', 'IRQ', [6, 26, 15, 0], 3],
  // Group J
  ['ARG', 'ALG', [6, 16, 21, 0], 15],
  ['AUT', 'JOR', [6, 16, 22, 0], 13],
  ['ARG', 'AUT', [6, 22, 13, 0], 7],
  ['JOR', 'ALG', [6, 22, 23, 0], 13],
  ['ALG', 'AUT', [6, 27, 22, 0], 15],
  ['JOR', 'ARG', [6, 27, 22, 0], 7],
  // Group K
  ['POR', 'COD', [6, 17, 13, 0], 8],
  ['UZB', 'COL', [6, 17, 22, 0], 0],
  ['POR', 'UZB', [6, 23, 13, 0], 8],
  ['COL', 'COD', [6, 23, 22, 0], 1],
  ['COL', 'POR', [6, 27, 19, 30], 10],
  ['COD', 'UZB', [6, 27, 19, 30], 9],
  // Group L
  ['ENG', 'CRO', [6, 17, 16, 0], 7],
  ['GHA', 'PAN', [6, 17, 19, 0], 3],
  ['ENG', 'GHA', [6, 23, 16, 0], 14],
  ['PAN', 'CRO', [6, 23, 19, 0], 3],
  ['PAN', 'ENG', [6, 27, 17, 0], 5],
  ['CRO', 'GHA', [6, 27, 17, 0], 11],
];

/** ET kickoff slots used only by the illustrative knockout bracket. */
const KICKOFF_HOURS = [16, 19, 22] as const;

const NUM_STADIUMS = 16;
const knockoutStadium = (i: number) => i % NUM_STADIUMS;

/**
 * The 32-team knockout bracket built from group placeholders, mirroring the
 * Rails seed: group winners (12) + runners-up (12) + 8 "best third-placed"
 * teams (groups A–H). Slots are indices into the flat TEAMS array (group order):
 * team t in group g occupies TEAMS[g*4 + t]. Winner=0, runner=1, third=2.
 */
function bracketSlots(): number[] {
  const winners = Array.from({ length: 12 }, (_, g) => g * 4 + 0);
  const runners = Array.from({ length: 12 }, (_, g) => g * 4 + 1);
  const thirds = Array.from({ length: 8 }, (_, g) => g * 4 + 2);
  return [...winners, ...runners, ...thirds]; // 32 slots
}

/** Builds the full ordered list of fixture specs (group stage + knockouts). */
export function buildFixtureSpecs(): FixtureSpec[] {
  const specs: FixtureSpec[] = [];

  for (const [home, away, [mon, day, hr, min], stadiumIdx] of GROUP_SCHEDULE) {
    specs.push({
      ref: { home, away },
      stadiumIdx,
      kickoffAt: etKickoff(mon, day, hr, min),
      stage: 'group',
    });
  }

  const bracket = bracketSlots(); // length 32

  // Round of 32: June 28 – July 3
  for (let i = 0; i < 16; i++) {
    const baseDay = 28 + Math.floor(i / 3);
    const kickoffAt = etKickoff(6, baseDay, KICKOFF_HOURS[i % 3]);
    specs.push({
      ref: { homeSlot: bracket[i], awaySlot: bracket[31 - i] },
      stadiumIdx: knockoutStadium(i),
      kickoffAt,
      stage: 'r32',
    });
  }
  // Round of 16: July 4 – 7
  for (let j = 0; j < 8; j++) {
    const baseDay = 4 + Math.floor(j / 2);
    const kickoffAt = etKickoff(7, baseDay, KICKOFF_HOURS[j % 3]);
    specs.push({
      ref: { homeSlot: bracket[2 * j], awaySlot: bracket[2 * j + 1] },
      stadiumIdx: knockoutStadium(j + 3),
      kickoffAt,
      stage: 'r16',
    });
  }
  // Quarter-finals: July 9 – 10
  for (let k = 0; k < 4; k++) {
    const baseDay = 9 + Math.floor(k / 2);
    const kickoffAt = etKickoff(7, baseDay, KICKOFF_HOURS[k % 2]);
    specs.push({
      ref: { homeSlot: bracket[4 * k], awaySlot: bracket[4 * k + 2] },
      stadiumIdx: knockoutStadium(k + 6),
      kickoffAt,
      stage: 'qf',
    });
  }
  // Semi-finals: July 14 – 15
  for (let s = 0; s < 2; s++) {
    const kickoffAt = etKickoff(7, 14 + s, 19);
    specs.push({
      ref: { homeSlot: bracket[8 * s], awaySlot: bracket[8 * s + 4] },
      stadiumIdx: knockoutStadium(s + 10),
      kickoffAt,
      stage: 'sf',
    });
  }
  // Third-place play-off: July 18
  specs.push({
    ref: { homeSlot: bracket[4], awaySlot: bracket[12] },
    stadiumIdx: 10,
    kickoffAt: etKickoff(7, 18, 19),
    stage: 'third_place',
  });
  // Final: July 19
  specs.push({
    ref: { homeSlot: bracket[0], awaySlot: bracket[8] },
    stadiumIdx: 5,
    kickoffAt: etKickoff(7, 19, 19),
    stage: 'final',
  });

  return specs;
}
