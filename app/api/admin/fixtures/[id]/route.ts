import type { NextRequest } from 'next/server';
import { route } from '../../../../../src/server/route';
import { requireAdmin } from '../../../../../src/server/session';
import { parseBody } from '../../../../../src/server/validation';
import { ValidationError } from '../../../../../src/server/errors';
import { enterResult } from '../../../../../src/server/services/admin-fixtures';
import { fixtureResultInputSchema } from '@pitchpredict/contracts';

export const dynamic = 'force-dynamic';

export function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return route(async () => {
    await requireAdmin();
    const { id } = await params;
    const fixtureId = Number(id);
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      throw new ValidationError('id must be a positive integer');
    }
    const input = await parseBody(fixtureResultInputSchema, req);
    return Response.json(await enterResult(fixtureId, input));
  });
}
