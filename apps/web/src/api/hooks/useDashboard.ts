'use client';

import { dashboardSchema, type Dashboard } from '@pitchpredict/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';

export const dashboardQueryKey = ['dashboard'] as const;

/** Aggregated dashboard payload for the current user. */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardQueryKey,
    queryFn: ({ signal }) =>
      apiFetch<Dashboard>('/dashboard', { schema: dashboardSchema, signal }),
  });
}
