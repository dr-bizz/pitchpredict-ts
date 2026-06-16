'use client';

import {
  championPickSchema,
  type ChampionPick,
  type ChampionPickInput,
} from '@pitchpredict/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

const championPickResponseSchema = championPickSchema.nullable();

export const championPickQueryKey = ['championPick'] as const;

/** The caller's current champion pick (or null). */
export function useChampionPick() {
  return useQuery({
    queryKey: championPickQueryKey,
    queryFn: ({ signal }) =>
      apiFetch<ChampionPick | null>('/champion-pick', {
        schema: championPickResponseSchema,
        signal,
      }),
  });
}

/**
 * Upsert the caller's champion pick. Invalidates dashboard (and the pick query)
 * on success. Locked once the tournament has started (422).
 */
export function useChampionPickMutation() {
  const queryClient = useQueryClient();

  return useMutation<ChampionPick, Error, ChampionPickInput>({
    mutationFn: (input) =>
      apiFetch<ChampionPick>('/champion-pick', {
        method: 'PUT',
        body: input,
        schema: championPickSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: championPickQueryKey });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
