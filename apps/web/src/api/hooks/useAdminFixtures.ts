'use client';

import {
  fixtureWithTeamsSchema,
  type FixtureResultInput,
  type FixtureWithTeams,
  type Stage,
  type Status,
} from '@pitchpredict/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../client';

const adminFixturesSchema = z.array(fixtureWithTeamsSchema);

export interface AdminFixturesFilters {
  stage?: Stage;
  status?: Status;
}

export function adminFixturesQueryKey(filters: AdminFixturesFilters = {}) {
  return ['adminFixtures', filters.stage ?? null, filters.status ?? null] as const;
}

/** Admin fixtures list, filtered by stage/status (admin role required). */
export function useAdminFixtures(filters: AdminFixturesFilters = {}) {
  return useQuery({
    queryKey: adminFixturesQueryKey(filters),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (filters.stage) params.set('stage', filters.stage);
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();
      return apiFetch<FixtureWithTeams[]>(
        qs ? `/admin/fixtures?${qs}` : '/admin/fixtures',
        { schema: adminFixturesSchema, signal }
      );
    },
  });
}

export interface AdminScoreVars {
  fixtureId: number;
  input: FixtureResultInput;
}

/**
 * Enter a fixture result (admin). Triggers the synchronous rescore on the API,
 * so invalidate leaderboard, dashboard, and the admin list on success.
 */
export function useAdminScoreFixture() {
  const queryClient = useQueryClient();

  return useMutation<FixtureWithTeams, Error, AdminScoreVars>({
    mutationFn: ({ fixtureId, input }) =>
      apiFetch<FixtureWithTeams>(`/admin/fixtures/${fixtureId}`, {
        method: 'PATCH',
        body: input,
        schema: fixtureWithTeamsSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['adminFixtures'] });
    },
  });
}
