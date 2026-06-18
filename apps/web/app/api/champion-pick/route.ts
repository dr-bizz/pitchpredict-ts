import type { NextRequest } from 'next/server';
import { route } from '../../../src/server/route';
import { requireUser } from '../../../src/server/session';
import { parseBody } from '../../../src/server/validation';
import { forUser, upsert } from '../../../src/server/services/champion-picks';
import { championPickInputSchema } from '@pitchpredict/contracts';

export const dynamic = 'force-dynamic';

export function GET() {
  return route(async () => {
    const user = await requireUser();
    return Response.json(await forUser(user.id));
  });
}

export function PUT(req: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const input = await parseBody(championPickInputSchema, req);
    return Response.json(await upsert(user.id, input));
  });
}
