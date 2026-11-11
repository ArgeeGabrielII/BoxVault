import {
  Body, Controller, Get, Post, Req, Res, UseGuards, Headers,
  UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, AccessPrincipal, IssuedSession } from './auth.service';
import { AccessGuard } from './access.guard';
import { AuthHardeningService } from './auth-hardening.service';

type AuthedRequest = Request & { principal: AccessPrincipal };
type LoginResult = { mfaRequired: boolean; challengeId?: string; expiresIn?: number; session?: IssuedSession };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService,
              private readonly hardening: AuthHardeningService) {}

  private publish(response: Response, session: IssuedSession) {
    // Refresh credentials must not be available to JavaScript or in JSON.
    response.cookie('boxvault_refresh', session.refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', path: '/api/v1/auth',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });
    response.setHeader('Cache-Control', 'no-store');
    return { accessToken: session.accessToken,
      accessExpiresIn: session.accessExpiresIn, tokenType: 'Bearer' };
  }
  private finish(res: Response, result: LoginResult) {
    res.setHeader('Cache-Control', 'no-store');
    if (result.mfaRequired) {
      return { mfaRequired: true, challengeId: result.challengeId,
        expiresIn: result.expiresIn };
    }
    if (!result.session) throw new UnauthorizedException();
    return { mfaRequired: false, ...this.publish(res, result.session) };
  }

  @Post('register')
  async register(@Body() body: { email?: unknown; password?: unknown; captchaToken?: unknown },
                 @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.hardening.captcha(body?.captchaToken, 'register');
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.register(body?.email, body?.password, req.ip ?? 'unknown');
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { token?: unknown },
                    @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.verifyEmail(body?.token);
  }

  @Post('password-reset/request')
  async resetRequest(@Body() body: { email?: unknown; captchaToken?: unknown },
                     @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.hardening.captcha(body?.captchaToken, 'reset');
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.requestPasswordReset(body?.email, req.ip ?? 'unknown');
  }

  @Post('password-reset/confirm')
  async resetConfirm(@Body() body: { token?: unknown; password?: unknown },
                     @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.resetPassword(body?.token, body?.password);
  }

  @Post('login')
  async login(@Body() body: { email?: unknown; password?: unknown },
              @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.hardening.captcha((body as { captchaToken?: unknown })?.captchaToken, 'login');
    const result = await this.auth.passwordLogin(body?.email, body?.password, req.ip ?? 'unknown');
    return this.finish(res, result);
  }

  @Post('google')
  async google(@Body() body: { idToken?: unknown },
               @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.hardening.captcha((body as { captchaToken?: unknown })?.captchaToken, 'google');
    const result = await this.auth.googleLogin(body?.idToken, req.ip ?? 'unknown');
    return this.finish(res, result);
  }

  @Post('mfa/challenges/verify')
  async verifyMfa(@Body() body: { challengeId?: unknown; code?: unknown },
                  @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.verifyChallenge(body?.challengeId, body?.code, req.ip ?? 'unknown');
    return { mfaRequired: false, ...this.publish(res, session) };
  }

  @UseGuards(AccessGuard)
  @Post('providers/google/link')
  async linkGoogle(@Req() req: AuthedRequest, @Body() body: { idToken?: unknown },
                   @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.linkGoogle(req.principal, body?.idToken);
    res.setHeader('Cache-Control', 'no-store');
    return result;
  }

  @UseGuards(AccessGuard)
  @Post('step-up')
  async stepUp(@Req() req: AuthedRequest, @Body() body: { code?: unknown },
               @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.adminStepUp(req.principal, body?.code);
  }

  @UseGuards(AccessGuard)
  @Post('mfa/disable')
  async disableMfa(@Req() req: AuthedRequest,
                   @Body() body: { password?: unknown; code?: unknown },
                   @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const result = await this.auth.disableTotp(req.principal, body?.password, body?.code);
    res.clearCookie('boxvault_refresh', { path: '/api/v1/auth' });
    return result;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Headers('origin') origin: string | undefined,
                @Res({ passthrough: true }) res: Response) {
    // A strict same-origin policy is enforced in addition to SameSite cookies.
    const allowed = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',');
    if (origin && !allowed.includes(origin)) throw new UnauthorizedException();
    const raw = req.headers.cookie?.split(';').map(x => x.trim())
      .find(x => x.startsWith('boxvault_refresh='));
    const token = raw ? raw.slice('boxvault_refresh='.length) : undefined;
    const session = await this.auth.refresh(token);
    return this.publish(res, session);
  }

  @UseGuards(AccessGuard)
  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.principal);
    res.clearCookie('boxvault_refresh', { path: '/api/v1/auth' });
    res.setHeader('Cache-Control', 'no-store');
    return { revoked: true };
  }

  @UseGuards(AccessGuard)
  @Post('mfa/totp/setup')
  async setup(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const value = await this.auth.startTotp(req.principal);
    res.setHeader('Cache-Control', 'no-store');
    return value;
  }

  @UseGuards(AccessGuard)
  @Post('mfa/totp/confirm')
  async confirm(@Req() req: AuthedRequest, @Body() body: { code?: unknown },
                @Res({ passthrough: true }) res: Response) {
    if (!body || typeof body.code !== 'string') throw new BadRequestException();
    const result = await this.auth.confirmTotp(req.principal, body.code);
    res.clearCookie('boxvault_refresh', { path: '/api/v1/auth' });
    res.setHeader('Cache-Control', 'no-store');
    return result;
  }
}
