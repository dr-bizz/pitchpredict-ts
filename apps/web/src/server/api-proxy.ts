import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '../auth';
import { signApiToken } from './jwt';

/**
 * BFF proxy core. Reads the NextAuth session server-side, mints an RS256 Bearer
 * token, and forwards the request to the Nest API, passing through the upstream
 * status and body (including 4xx/5xx such as 422 lock errors). The browser never
 * holds the API token.
 */

function apiUrl(): string {
  return process.env['API_URL'] ?? 'http://localhost:3334';
}

/** Headers that must not be copied verbatim to the upstream request. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'authorization',
  'cookie',
]);

/** Headers that must not be copied verbatim back to the client. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

export async function proxy(
  req: NextRequest,
  path: string[]
): Promise<NextResponse> {
  const session = await auth();

  const targetPath = '/' + path.map(encodeURIComponent).join('/');
  const search = req.nextUrl.search;
  const target = `${apiUrl()}${targetPath}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  if (session?.user?.id) {
    const token = await signApiToken({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    });
    headers.set('authorization', `Bearer ${token}`);
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstream = await fetch(target, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  const responseBody = await upstream.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
