import type { NextRequest } from 'next/server';
import { route } from '../../../../../src/server/route';
import { requireUser } from '../../../../../src/server/session';
import { parseBody } from '../../../../../src/server/validation';
import { ValidationError } from '../../../../../src/server/errors';
import { upsert } from '../../../../../src/server/services/predictions';
import { predictionInputSchema } from '@pitchpredict/contracts';

export const dynamic = 'force-dynamic';

export function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    const user = await requireUser();
    const { id } = await params;
    const fixtureId = Number(id);
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      throw new ValidationError('id must be a positive integer');
    }
    const input = await parseBody(predictionInputSchema, req);
    return Response.json(await upsert(user.id, fixtureId, input));
  });
}
