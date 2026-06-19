import { route } from '../../../../src/server/route';
import { requireAdmin } from '../../../../src/server/session';
import { listTeams } from '../../../../src/server/services/admin-fixtures';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    await requireAdmin();
    return Response.json(await listTeams());
  });
}
