import type { ZodSchema } from 'zod';
import { ValidationError } from './errors';

export async function parseBody<T>(schema: ZodSchema<T>, req: Request): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T>(schema: ZodSchema<T>, searchParams: URLSearchParams): T {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const result = schema.safeParse(obj);
  if (!result.success) {
    throw new ValidationError(result.error.flatten());
  }
  return result.data;
}
