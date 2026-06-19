export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message); this.name = 'AppError';
  }
}
export class ValidationError  extends AppError { constructor(d: unknown) { super(400, 'Validation failed', d); } }
export class UnauthorizedError extends AppError { constructor(m = 'Unauthorized') { super(401, m); } }
export class ForbiddenError    extends AppError { constructor(m = 'Forbidden') { super(403, m); } }
export class NotFoundError     extends AppError { constructor(m = 'Not found') { super(404, m); } }
export class ConflictError     extends AppError { constructor(m = 'Conflict') { super(409, m); } }
export class BusinessError     extends AppError { constructor(m: string) { super(422, m); } }

export function toErrorResponse(err: AppError): Response {
  const body: Record<string, unknown> = {
    statusCode: err.status,
    message: err.message,
    error: statusText(err.status),
  };
  if (err.details !== undefined) {
    body['details'] = err.details;
  }
  return Response.json(body, { status: err.status });
}

function statusText(status: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return map[status] ?? 'Error';
}
