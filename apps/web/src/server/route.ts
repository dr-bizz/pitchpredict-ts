import { AppError, toErrorResponse } from './errors';

export async function route(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return toErrorResponse(err);
    console.error(err);
    return Response.json(
      { statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
