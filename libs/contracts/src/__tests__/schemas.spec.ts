import { describe, expect, it } from 'vitest';
import {
  predictionInputSchema,
  registerSchema,
  teamSchema,
} from '../index';

describe('predictionInputSchema', () => {
  it('rejects scores above 20', () => {
    expect(
      predictionInputSchema.safeParse({ homeScore: 21, awayScore: 0 }).success
    ).toBe(false);
  });

  it('rejects negative scores', () => {
    expect(
      predictionInputSchema.safeParse({ homeScore: -1, awayScore: 0 }).success
    ).toBe(false);
  });

  it('accepts the boundary scores 0 and 20', () => {
    expect(
      predictionInputSchema.safeParse({ homeScore: 0, awayScore: 20 }).success
    ).toBe(true);
  });
});

describe('registerSchema', () => {
  it('rejects a mismatched password confirmation', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      passwordConfirmation: 'different123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a matching password confirmation', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      passwordConfirmation: 'password123',
    });
    expect(result.success).toBe(true);
  });
});

describe('teamSchema code refinement', () => {
  const base = { id: 1, name: 'Brazil', groupName: 'A', flagEmoji: '🇧🇷' };

  it('rejects lowercase 3-letter codes', () => {
    expect(teamSchema.safeParse({ ...base, code: 'ab' }).success).toBe(false);
  });

  it('rejects 4-letter codes', () => {
    expect(teamSchema.safeParse({ ...base, code: 'ABCD' }).success).toBe(false);
  });

  it('accepts a valid 3 uppercase letter code', () => {
    expect(teamSchema.safeParse({ ...base, code: 'BRA' }).success).toBe(true);
  });
});
