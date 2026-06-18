'use client';

import {
  fixtureWithTeamsSchema,
  teamSchema,
  type FixtureResultInput,
  type FixtureTeamsInput,
  type FixtureWithTeams,
  type Stage,
  type Status,
  type Team,
} from '@pitchpredict/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch, assignFixtureTeams } from '../client';

const adminFixturesSchema = z.array(fixtureWithTeamsSchema);
const adminTeamsSchema = z.array(teamSchema);

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

/**
 * Full team catalog for knockout assignment (admin role required). Sourced from
 * a dedicated endpoint, not the dashboard, so it is never empty after the
 * champion-pick deadline — exactly when knockout teams are actually assigned.
 */
export function useAdminTeams() {
  return useQuery({
    queryKey: ['adminTeams'] as const,
    queryFn: ({ signal }) =>
      apiFetch<Team[]>('/admin/teams', { schema: adminTeamsSchema, signal }),
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

export interface AdminAssignTeamsVars {
  fixtureId: number;
  input: FixtureTeamsInput;
}

/**
 * Assign (or clear) a knockout fixture's teams (admin). Refreshes the admin
 * list and the fixtures/dashboard views, since the assignment changes which
 * matches are predictable.
 */
export function useAdminAssignTeams() {
  const queryClient = useQueryClient();

  return useMutation<FixtureWithTeams, Error, AdminAssignTeamsVars>({
    mutationFn: ({ fixtureId, input }) => assignFixtureTeams(fixtureId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFixtures'] });
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
