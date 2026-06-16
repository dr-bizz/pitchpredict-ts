import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain rule violation (e.g. prediction locked, champion picks locked).
 * Mapped to HTTP 422 Unprocessable Entity to match the Rails copy/behaviour.
 */
export class BusinessException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message, error: 'Unprocessable Entity' },
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}
