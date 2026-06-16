import { BadRequestException } from '@nestjs/common';
import type { ZodSchema, infer as ZodInfer } from 'zod';

/**
 * Per-route Zod validation helpers. Used with Nest's `@Body()`/`@Query()` via the
 * `transform` option, or invoked directly inside a controller. On a parse failure
 * they throw a `BadRequestException` (400) carrying the flattened Zod error so the
 * BFF/client can surface field-level messages.
 *
 *   @Body(zodBody(predictionInputSchema)) dto: PredictionInput
 *   @Query(zodQuery(fixtureQuerySchema)) query: FixtureQuery
 */
class ZodValidationPipe<T extends ZodSchema> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): ZodInfer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}

export function zodBody<T extends ZodSchema>(schema: T): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

export function zodQuery<T extends ZodSchema>(schema: T): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

export { ZodValidationPipe };
