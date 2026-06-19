import { route } from '../../../src/server/route';
import { requireUser } from '../../../src/server/session';
import { forUser } from '../../../src/server/services/dashboard';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    const user = await requireUser();
    return Response.json(await forUser(user.id));
  });
}
