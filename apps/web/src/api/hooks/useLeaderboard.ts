'use client';

import {
  leaderboardRowSchema,
  type LeaderboardRow,
} from '@pitchpredict/contracts';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../client';

const leaderboardSchema = z.array(leaderboardRowSchema);

export const leaderboardQueryKey = ['leaderboard'] as const;

/** The ranked leaderboard, polled live every 15s. */
export function useLeaderboard() {
  return useQuery({
    queryKey: leaderboardQueryKey,
    queryFn: ({ signal }) =>
      apiFetch<LeaderboardRow[]>('/leaderboard', {
        schema: leaderboardSchema,
        signal,
      }),
    refetchInterval: 15_000,
  });
}
