/**
 * The 48 real World Cup 2026 teams, grouped by the official Final Draw groups
 * (Washington, DC, 5 Dec 2025). Ported from the Rails seed `TEAMS_BY_GROUP`.
 */
export interface TeamSeed {
  name: string;
  code: string;
  flagEmoji: string;
  confederation: string;
  groupName: string;
}

const TEAMS_BY_GROUP: Record<
  string,
  ReadonlyArray<readonly [string, string, string, string]>
> = {
  A: [
    ['Mexico', 'MEX', '🇲🇽', 'CONCACAF'],
    ['South Korea', 'KOR', '🇰🇷', 'AFC'],
    ['Czechia', 'CZE', '🇨🇿', 'UEFA'],
    ['South Africa', 'RSA', '🇿🇦', 'CAF'],
  ],
  B: [
    ['Canada', 'CAN', '🇨🇦', 'CONCACAF'],
    ['Switzerland', 'SUI', '🇨🇭', 'UEFA'],
    ['Qatar', 'QAT', '🇶🇦', 'AFC'],
    ['Bosnia and Herzegovina', 'BIH', '🇧🇦', 'UEFA'],
  ],
  C: [
    ['Brazil', 'BRA', '🇧🇷', 'CONMEBOL'],
    ['Morocco', 'MAR', '🇲🇦', 'CAF'],
    ['Scotland', 'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'UEFA'],
    ['Haiti', 'HAI', '🇭🇹', 'CONCACAF'],
  ],
  D: [
    ['United States', 'USA', '🇺🇸', 'CONCACAF'],
    ['Paraguay', 'PAR', '🇵🇾', 'CONMEBOL'],
    ['Australia', 'AUS', '🇦🇺', 'AFC'],
    ['Türkiye', 'TUR', '🇹🇷', 'UEFA'],
  ],
  E: [
    ['Germany', 'GER', '🇩🇪', 'UEFA'],
    ['Ecuador', 'ECU', '🇪🇨', 'CONMEBOL'],
    ['Ivory Coast', 'CIV', '🇨🇮', 'CAF'],
    ['Curaçao', 'CUW', '🇨🇼', 'CONCACAF'],
  ],
  F: [
    ['Netherlands', 'NED', '🇳🇱', 'UEFA'],
    ['Japan', 'JPN', '🇯🇵', 'AFC'],
    ['Sweden', 'SWE', '🇸🇪', 'UEFA'],
    ['Tunisia', 'TUN', '🇹🇳', 'CAF'],
  ],
  G: [
    ['Belgium', 'BEL', '🇧🇪', 'UEFA'],
    ['Egypt', 'EGY', '🇪🇬', 'CAF'],
    ['Iran', 'IRN', '🇮🇷', 'AFC'],
    ['New Zealand', 'NZL', '🇳🇿', 'OFC'],
  ],
  H: [
    ['Spain', 'ESP', '🇪🇸', 'UEFA'],
    ['Uruguay', 'URU', '🇺🇾', 'CONMEBOL'],
    ['Saudi Arabia', 'KSA', '🇸🇦', 'AFC'],
    ['Cape Verde', 'CPV', '🇨🇻', 'CAF'],
  ],
  I: [
    ['France', 'FRA', '🇫🇷', 'UEFA'],
    ['Senegal', 'SEN', '🇸🇳', 'CAF'],
    ['Norway', 'NOR', '🇳🇴', 'UEFA'],
    ['Iraq', 'IRQ', '🇮🇶', 'AFC'],
  ],
  J: [
    ['Argentina', 'ARG', '🇦🇷', 'CONMEBOL'],
    ['Austria', 'AUT', '🇦🇹', 'UEFA'],
    ['Algeria', 'ALG', '🇩🇿', 'CAF'],
    ['Jordan', 'JOR', '🇯🇴', 'AFC'],
  ],
  K: [
    ['Portugal', 'POR', '🇵🇹', 'UEFA'],
    ['Colombia', 'COL', '🇨🇴', 'CONMEBOL'],
    ['Uzbekistan', 'UZB', '🇺🇿', 'AFC'],
    ['DR Congo', 'COD', '🇨🇩', 'CAF'],
  ],
  L: [
    ['England', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'UEFA'],
    ['Croatia', 'CRO', '🇭🇷', 'UEFA'],
    ['Ghana', 'GHA', '🇬🇭', 'CAF'],
    ['Panama', 'PAN', '🇵🇦', 'CONCACAF'],
  ],
};

/** Flattened list of all 48 teams, in group order (A1..A4, B1..B4, ...). */
export const TEAMS: TeamSeed[] = Object.entries(TEAMS_BY_GROUP).flatMap(
  ([groupName, rows]) =>
    rows.map(([name, code, flagEmoji, confederation]) => ({
      name,
      code,
      flagEmoji,
      confederation,
      groupName,
    }))
);

/**
 * Champion-pick contenders — all present in the real draw (no Italy: they did
 * not qualify for 2026). Mirrors the Rails `CONTENDER_CODES`.
 */
export const CONTENDER_CODES = [
  'BRA',
  'FRA',
  'ARG',
  'ESP',
  'ENG',
  'GER',
  'POR',
  'NED',
  'BEL',
  'URU',
] as const;
