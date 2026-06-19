import { route } from '../../../src/server/route';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
