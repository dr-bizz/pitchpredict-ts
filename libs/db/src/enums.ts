import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['player', 'admin']);

export const stageEnum = pgEnum('stage', [
  'group',
  'r32',
  'r16',
  'qf',
  'sf',
  'third_place',
  'final',
]);

export const statusEnum = pgEnum('status', ['scheduled', 'live', 'finished']);
