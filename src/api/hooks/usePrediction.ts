'use client';

import {
  predictionSchema,
  type Prediction,
  type PredictionInput,
} from '@pitchpredict/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../client';

export interface PredictionMutationVars {
  fixtureId: number;
  input: PredictionInput;
}

/**
 * Upsert the caller's prediction for a fixture. On success invalidates the
 * fixtures + dashboard queries so cards and counts refresh. A locked fixture
 * surfaces as an `ApiError` (422).
 */
export function usePrediction() {
  const queryClient = useQueryClient();

  return useMutation<Prediction, Error, PredictionMutationVars>({
    mutationFn: ({ fixtureId, input }) =>
      apiFetch<Prediction>(`/fixtures/${fixtureId}/prediction`, {
        method: 'PUT',
        body: input,
        schema: predictionSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
