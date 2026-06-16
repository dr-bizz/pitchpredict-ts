import type { Role } from '@pitchpredict/contracts';

/** The authenticated principal attached to `request.user` after JWT validation. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
