import {
  isFixtureLocked,
  championPicksLocked,
  CHAMPION_PICK_DEADLINE,
} from './fixture-rules';

describe('isFixtureLocked', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('is open for a scheduled fixture kicking off in the future', () => {
    const f = {
      kickoffAt: new Date('2026-06-16T13:00:00Z'),
      status: 'scheduled',
      homeTeamId: 10,
      awayTeamId: 20,
    };
    expect(isFixtureLocked(f, now)).toBe(false);
  });

  it('is locked once kickoff has passed, even if still scheduled', () => {
    const f = { kickoffAt: new Date('2026-06-16T11:00:00Z'), status: 'scheduled' };
    expect(isFixtureLocked(f, now)).toBe(true);
  });

  it('is locked exactly at kickoff', () => {
    const f = { kickoffAt: new Date('2026-06-16T12:00:00Z'), status: 'scheduled' };
    expect(isFixtureLocked(f, now)).toBe(true);
  });

  it('is locked when live before kickoff', () => {
    const f = { kickoffAt: new Date('2026-06-16T13:00:00Z'), status: 'live' };
    expect(isFixtureLocked(f, now)).toBe(true);
  });

  it('is locked when finished before kickoff', () => {
    const f = { kickoffAt: new Date('2026-06-16T13:00:00Z'), status: 'finished' };
    expect(isFixtureLocked(f, now)).toBe(true);
  });

  it('defaults `now` to the current time', () => {
    const f = {
      kickoffAt: new Date(Date.now() + 60_000),
      status: 'scheduled',
      homeTeamId: 10,
      awayTeamId: 20,
    };
    expect(isFixtureLocked(f)).toBe(false);
  });

  it('is locked when the home team is not yet assigned (TBD knockout slot)', () => {
    const f = {
      kickoffAt: new Date('2026-06-16T13:00:00Z'),
      status: 'scheduled',
      homeTeamId: null,
      awayTeamId: 20,
    };
    expect(isFixtureLocked(f, now)).toBe(true);
  });

  it('is locked when the away team is not yet assigned (TBD knockout slot)', () => {
    const f = {
      kickoffAt: new Date('2026-06-16T13:00:00Z'),
      status: 'scheduled',
      homeTeamId: 10,
      awayTeamId: null,
    };
    expect(isFixtureLocked(f, now)).toBe(true);
  });

  it('is open once both teams are assigned and kickoff is still in the future', () => {
    const f = {
      kickoffAt: new Date('2026-06-16T13:00:00Z'),
      status: 'scheduled',
      homeTeamId: 10,
      awayTeamId: 20,
    };
    expect(isFixtureLocked(f, now)).toBe(false);
  });
});

describe('championPicksLocked', () => {
  it('is open before the fixed deadline', () => {
    const before = new Date('2026-06-20T21:59:59Z');
    expect(championPicksLocked(before)).toBe(false);
  });

  it('is locked exactly at the deadline', () => {
    expect(championPicksLocked(CHAMPION_PICK_DEADLINE)).toBe(true);
  });

  it('is locked after the deadline', () => {
    const after = new Date('2026-06-20T22:00:01Z');
    expect(championPicksLocked(after)).toBe(true);
  });

  it('uses the 2026-06-20T22:00:00Z deadline by default', () => {
    expect(CHAMPION_PICK_DEADLINE.toISOString()).toBe('2026-06-20T22:00:00.000Z');
  });
});
