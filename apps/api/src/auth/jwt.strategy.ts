import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { zRole } from '@pitchpredict/contracts';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../config/env';
import type { AuthUser } from './auth-user';

interface JwtPayload {
  sub: string | number;
  name?: string;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: env.jwksUri as string,
        cache: true,
        rateLimit: true,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    const role = zRole.safeParse(payload.role);
    if (!payload.sub || !role.success) {
      throw new UnauthorizedException('Invalid token claims');
    }
    return {
      id: Number(payload.sub),
      name: payload.name ?? '',
      email: payload.email ?? '',
      role: role.data,
    };
  }
}
