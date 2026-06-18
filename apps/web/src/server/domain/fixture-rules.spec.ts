import { isFixtureLocked, tournamentStarted } from './fixture-rules';

describe('isFixtureLocked', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('is open for a scheduled fixture kicking off in the future', () => {
    const f = { kickoffAt: new Date('2026-06-16T13:00:00Z'), status: 'scheduled' };
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
    const f = { kickoffAt: new Date(Date.now() + 60_000), status: 'scheduled' };
    expect(isFixtureLocked(f)).toBe(false);
  });
});

describe('tournamentStarted', () => {
  const now = new Date('2026-06-16T12:00:00Z');

  it('is false when there is no earliest kickoff', () => {
    expect(tournamentStarted(null, now)).toBe(false);
  });

  it('is false when the earliest kickoff is in the future', () => {
    expect(tournamentStarted(new Date('2026-06-16T13:00:00Z'), now)).toBe(false);
  });

  it('is true once the earliest kickoff has passed', () => {
    expect(tournamentStarted(new Date('2026-06-16T11:00:00Z'), now)).toBe(true);
  });

  it('is true exactly at the earliest kickoff', () => {
    expect(tournamentStarted(new Date('2026-06-16T12:00:00Z'), now)).toBe(true);
  });
});
