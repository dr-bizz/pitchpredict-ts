import { z } from 'zod';
import { userSchema } from './user';

export const leaderboardRowSchema = z.object({
  rank: z.number().int(),
  user: userSchema,
  totalPoints: z.number().int(),
  predictionsCount: z.number().int(),
  exactCount: z.number().int(),
  diffCount: z.number().int(),
  tendencyCount: z.number().int(),
});
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;
