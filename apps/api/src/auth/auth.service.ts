import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { schema } from '@pitchpredict/db';
import type {
  ForgotInput,
  LoginInput,
  RegisterInput,
  ResetInput,
  User,
} from '@pitchpredict/contracts';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { BusinessException } from '../common/business.exception';
import { env } from '../config/env';
import { DRIZZLE, type DrizzleDb } from '../db/db.module';

const BCRYPT_COST = 12;
const RESET_TOKEN_TTL = '1h';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  private get resetKey(): Uint8Array {
    return new TextEncoder().encode(env.resetSecret);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Hash the password (cost 12) and create a `player`; 409 on duplicate email. */
  async register(dto: RegisterInput): Promise<User> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const existing = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    try {
      const [user] = await this.db
        .insert(schema.users)
        .values({ name: dto.name, email, passwordHash, role: 'player' })
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          role: schema.users.role,
        });
      return user;
    } catch (err) {
      // Unique-violation race: another insert beat us to it.
      if (err instanceof Error && /duplicate key|unique/i.test(err.message)) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  /** Verify credentials; return the public user or throw 401. */
  async login(dto: LoginInput): Promise<User> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  /**
   * Issue an expiring reset token if the user exists; the email send is stubbed
   * (logged) in dev. Always resolves so the endpoint cannot enumerate accounts.
   */
  async forgot(dto: ForgotInput): Promise<void> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    if (!user) {
      return;
    }
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime(RESET_TOKEN_TTL)
      .sign(this.resetKey);
    // Stub: stand-in for PasswordsMailer.deliver_later in the Rails app.
    this.logger.log(`Password reset requested for ${email}. Token: ${token}`);
  }

  /** Verify the reset token and update the password hash; 422 on invalid/expired. */
  async reset(dto: ResetInput): Promise<void> {
    let userId: number;
    try {
      const { payload } = await jwtVerify(dto.token, this.resetKey);
      userId = Number(payload.sub);
      if (!userId) {
        throw new Error('missing subject');
      }
    } catch {
      throw new BusinessException('Reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const [updated] = await this.db
      .update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id });
    if (!updated) {
      throw new BusinessException('Reset token is invalid or has expired');
    }
  }
}
