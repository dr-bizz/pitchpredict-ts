import { z } from 'zod';

export const zRole = z.enum(['player', 'admin']);
export type Role = z.infer<typeof zRole>;

export const zStage = z.enum([
  'group',
  'r32',
  'r16',
  'qf',
  'sf',
  'third_place',
  'final',
]);
export type Stage = z.infer<typeof zStage>;

export const zStatus = z.enum(['scheduled', 'live', 'finished']);
export type Status = z.infer<typeof zStatus>;

/**
 * Ordered list of tabs surfaced in the predictions UI. `upcoming` is a
 * synthetic tab (future scheduled fixtures) and is not a database stage.
 */
export const STAGE_TABS = [
  'upcoming',
  'group',
  'r32',
  'r16',
  'qf',
  'sf',
  'third_place',
  'final',
] as const;
export type StageTab = (typeof STAGE_TABS)[number];
