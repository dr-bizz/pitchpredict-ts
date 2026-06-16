import { z } from 'zod';
import { leaderboardRowSchema } from './leaderboard';
import { teamSchema } from './team';

export const dashboardSchema = z.object({
  topRows: z.array(leaderboardRowSchema),
  myRow: leaderboardRowSchema.nullable(),
  fixturesCount: z.number().int(),
  predictedCount: z.number().int(),
  totalPoints: z.number().int(),
  championPick: z
    .object({
      teamId: z.number().int(),
      team: teamSchema,
    })
    .nullable(),
  championLocked: z.boolean(),
  teams: z.array(teamSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
