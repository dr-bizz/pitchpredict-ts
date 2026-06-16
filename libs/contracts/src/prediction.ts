import { predictions } from '@pitchpredict/db';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const predictionSchema = createSelectSchema(predictions);
export type Prediction = z.infer<typeof predictionSchema>;

/** Body for upserting a prediction. Scores are bounded 0–20 inclusive. */
export const predictionInputSchema = z.object({
  homeScore: z.number().int().min(0).max(20),
  awayScore: z.number().int().min(0).max(20),
});
export type PredictionInput = z.infer<typeof predictionInputSchema>;
