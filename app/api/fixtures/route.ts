import type { NextRequest } from 'next/server';
import { route } from '../../../src/server/route';
import { requireUser } from '../../../src/server/session';
import { parseQuery } from '../../../src/server/validation';
import { list } from '../../../src/server/services/fixtures';
import { fixtureQuerySchema } from '@pitchpredict/contracts';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const { stage } = parseQuery(fixtureQuerySchema, req.nextUrl.searchParams);
    return Response.json(await list(stage, user.id));
  });
}
