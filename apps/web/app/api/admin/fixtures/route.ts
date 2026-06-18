import type { NextRequest } from 'next/server';
import { route } from '../../../../src/server/route';
import { requireAdmin } from '../../../../src/server/session';
import { parseQuery } from '../../../../src/server/validation';
import { list } from '../../../../src/server/services/admin-fixtures';
import { adminFixtureQuerySchema } from '@pitchpredict/contracts';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return route(async () => {
    await requireAdmin();
    const { stage, status } = parseQuery(adminFixtureQuerySchema, req.nextUrl.searchParams);
    return Response.json(await list(stage, status));
  });
}
