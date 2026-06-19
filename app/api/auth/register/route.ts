import type { NextRequest } from 'next/server';
import { registerSchema } from '@pitchpredict/contracts';
import { route } from '../../../../src/server/route';
import { parseBody } from '../../../../src/server/validation';
import { register } from '../../../../src/server/services/auth';

export const dynamic = 'force-dynamic';

export function POST(req: NextRequest) {
  return route(async () => {
    const body = await parseBody(registerSchema, req);
    const user = await register(body);
    return Response.json(user);
  });
}
