'use client';

import {
  fixtureWithTeamsSchema,
  predictionSchema,
  type StageTab,
} from '@pitchpredict/contracts';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../client';

/** Mirrors the Nest `FixturesResponse` (resolved stage + grouped fixtures + caller predictions). */
export const fixturesResponseSchema = z.object({
  stage: z.string(),
  groups: z.array(
    z.object({
      label: z.string(),
      fixtures: z.array(fixtureWithTeamsSchema),
    })
  ),
  predictionsByFixtureId: z.record(z.string(), predictionSchema),
});
export type FixturesResponse = z.infer<typeof fixturesResponseSchema>;

export function fixturesQueryKey(stage?: StageTab) {
  return ['fixtures', stage ?? 'upcoming'] as const;
}

export function useFixtures(stage?: StageTab) {
  return useQuery({
    queryKey: fixturesQueryKey(stage),
    queryFn: ({ signal }) =>
      apiFetch<FixturesResponse>(
        stage ? `/fixtures?stage=${encodeURIComponent(stage)}` : '/fixtures',
        { schema: fixturesResponseSchema, signal }
      ),
  });
}
