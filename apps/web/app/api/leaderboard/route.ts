import { route } from '../../../src/server/route';
import { requireUser } from '../../../src/server/session';
import { rows } from '../../../src/server/services/leaderboard';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    await requireUser();
    return Response.json(await rows());
  });
}
