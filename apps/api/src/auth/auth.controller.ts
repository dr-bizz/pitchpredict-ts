import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  type User,
} from '@pitchpredict/contracts';
import { zodBody } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

/** Public auth endpoints (no guard). Consumed by the web app's NextAuth + forms. */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body(zodBody(registerSchema))
    dto: ReturnType<typeof registerSchema.parse>
  ): Promise<User> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(zodBody(loginSchema)) dto: ReturnType<typeof loginSchema.parse>
  ): Promise<User> {
    return this.authService.login(dto);
  }

  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  async forgot(
    @Body(zodBody(forgotSchema)) dto: ReturnType<typeof forgotSchema.parse>
  ): Promise<{ ok: true }> {
    await this.authService.forgot(dto);
    return { ok: true };
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async reset(
    @Body(zodBody(resetSchema)) dto: ReturnType<typeof resetSchema.parse>
  ): Promise<{ ok: true }> {
    await this.authService.reset(dto);
    return { ok: true };
  }
}
