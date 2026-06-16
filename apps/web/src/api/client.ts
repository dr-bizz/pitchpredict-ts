import type { ZodType } from 'zod';

/**
 * Browser-side API client. Every request goes through the BFF proxy
 * (`/api/proxy/*`), never directly to Nest. Non-2xx responses throw a typed
 * `ApiError` carrying the upstream status and a best-effort message. Successful
 * responses are validated against the relevant `contracts` schema.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const PROXY_BASE = '/api/proxy';

/** Keys whose string values are ISO timestamps and must be revived to `Date`. */
const DATE_KEYS = new Set([
  'kickoffAt',
  'createdAt',
  'updatedAt',
]);

/**
 * Recursively revive ISO date strings on known timestamp keys so Drizzle-derived
 * `z.date()` schemas (`kickoffAt`, `createdAt`, `updatedAt`) parse JSON payloads.
 */
function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reviveDates);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_KEYS.has(key) && typeof val === 'string') {
        const parsed = new Date(val);
        out[key] = Number.isNaN(parsed.getTime()) ? val : parsed;
      } else {
        out[key] = reviveDates(val);
      }
    }
    return out;
  }
  return value;
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m) && typeof m[0] === 'string') return m[0];
  }
  return fallback;
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Schema used to parse + type the successful JSON response. */
  schema?: ZodType<unknown>;
  signal?: AbortSignal;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, schema, signal } = options;

  const res = await fetch(`${PROXY_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  let parsedBody: unknown = undefined;
  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      messageFromBody(parsedBody, res.statusText || 'Request failed'),
      parsedBody
    );
  }

  if (!schema) {
    return parsedBody as T;
  }

  return schema.parse(reviveDates(parsedBody)) as T;
}
