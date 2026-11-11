import {
  Injectable, OnModuleDestroy, ServiceUnavailableException,
  HttpException, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { createHmac } from 'node:crypto';

const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 254) return null;
  const normalized = input.trim().toLowerCase();
  return emailFormat.test(normalized) ? normalized : null;
}

@Injectable()
export class AuthHardeningService implements OnModuleDestroy {
  private readonly db: PrismaClient;
  constructor() {
    this.db = new PrismaClient({
      datasources: { db: { url: process.env.AUTH_DATABASE_URL ||
        'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured' } },
    });
  }
  async onModuleDestroy() { await this.db.$disconnect(); }

  private hash(value: string): string {
    const pepper = process.env.AUTH_SESSION_PEPPER;
    if (!pepper || pepper.length < 32)
      throw new ServiceUnavailableException('Authentication is not configured');
    return createHmac('sha256', pepper).update(value).digest('hex');
  }

  /** Atomic across all API instances and processes, not memory-local. */
  async limit(category: string, ip: string, account?: string) {
    const sensitive = category === 'mfa-confirm' || category === 'mfa-disable' ||
      category === 'admin-step-up' || category === 'mfa-rotate';
    const hourly = category === 'reset' || category === 'register';
    const now = new Date(), seconds = sensitive ? 600 : hourly ? 3600 : 60;
    const maximum = sensitive || hourly ? 5 : 10;
    const keys = [this.hash(category + ':ip:' + ip)];
    if (account) keys.push(this.hash(category + ':account:' + account));
    for (const key of keys) {
      const values = await this.db.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "AuthRateLimit" ("key", "count", "windowEnds")
        VALUES (${key}, 1, ${new Date(now.getTime() + seconds * 1000)})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "AuthRateLimit"."windowEnds" <= ${now}
            THEN 1 ELSE "AuthRateLimit"."count" + 1 END,
          "windowEnds" = CASE WHEN "AuthRateLimit"."windowEnds" <= ${now}
            THEN ${new Date(now.getTime() + seconds * 1000)}
            ELSE "AuthRateLimit"."windowEnds" END
        RETURNING "count"
      `;
      if (!values[0] || values[0].count > maximum)
        throw new HttpException('Try again later', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async captcha(token: unknown, action: string) {
    // The only bypass is an explicit CI/dev configuration, never production.
    if (process.env.AUTH_BOT_PROTECTION_MODE === 'off' && process.env.NODE_ENV === 'test')
      return;
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const hostname = process.env.RECAPTCHA_HOSTNAME;
    if (!secret || !hostname) throw new ServiceUnavailableException('Bot protection is not configured');
    if (typeof token !== 'string' || token.length < 16 || token.length > 4096)
      throw new UnauthorizedException('Bot verification failed');

    const address = process.env.NODE_ENV === 'test' && process.env.RECAPTCHA_VERIFY_URL
      ? process.env.RECAPTCHA_VERIFY_URL : 'https://www.google.com/recaptcha/api/siteverify';
    let response: {
      success?: boolean; hostname?: string; action?: string;
      score?: number; challenge_ts?: string;
    };
    try {
      const req = await fetch(address, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(3500),
      });
      if (!req.ok) throw new Error('verification unavailable');
      response = await req.json() as typeof response;
    } catch {
      throw new ServiceUnavailableException('Bot verification unavailable');
    }
    const challengeAt = Date.parse(response.challenge_ts || '');
    if (!response.success || response.hostname !== hostname ||
        response.action !== action || typeof response.score !== 'number' ||
        response.score < 0.5 || !Number.isFinite(challengeAt) ||
        Math.abs(Date.now() - challengeAt) > 120_000)
      throw new UnauthorizedException('Bot verification failed');
    // A replay is denied even across API instances.
    const replayKey = this.hash('captcha:' + token);
    const until = new Date(Date.now() + 180_000);
    const result = await this.db.$executeRaw`
      INSERT INTO "AuthRateLimit" ("key", "count", "windowEnds")
      VALUES (${replayKey}, 1, ${until})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "AuthRateLimit"."windowEnds" <= CURRENT_TIMESTAMP
          THEN 1 ELSE "AuthRateLimit"."count" + 1 END,
        "windowEnds" = CASE WHEN "AuthRateLimit"."windowEnds" <= CURRENT_TIMESTAMP
          THEN ${until} ELSE "AuthRateLimit"."windowEnds" END
    `;
    if (result !== 1) throw new UnauthorizedException('Bot verification failed');
    const row = await this.db.authRateLimit.findUnique({ where: { key: replayKey } });
    if (row?.count !== 1) throw new UnauthorizedException('Bot verification failed');
  }

  assertMailerConfigured() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.PUBLIC_WEB_URL)
      throw new ServiceUnavailableException('Email delivery is not configured');
    const isTest = process.env.NODE_ENV === 'test' &&
      process.env.SMTP_ALLOW_PLAINTEXT_TEST === 'true' &&
      process.env.SMTP_HOST === '127.0.0.1';
    if (!isTest && (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD))
      throw new ServiceUnavailableException('Email delivery is not configured');
  }

  async email(email: string, purpose: 'verify-email' | 'reset-password', token: string) {
    const host = process.env.SMTP_HOST, from = process.env.SMTP_FROM,
      origin = process.env.PUBLIC_WEB_URL;
    if (!host || !from || !origin || !/^https:\/\//.test(origin) &&
        !(process.env.NODE_ENV === 'test' && /^http:\/\/localhost/.test(origin || '')))
      throw new ServiceUnavailableException('Email delivery is not configured');

    const port = Number(process.env.SMTP_PORT || '587');
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new ServiceUnavailableException('Invalid mail configuration');
    const insecureTest = process.env.NODE_ENV === 'test' &&
      process.env.SMTP_ALLOW_PLAINTEXT_TEST === 'true' && host === '127.0.0.1';
    if (!insecureTest && (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD))
      throw new ServiceUnavailableException('SMTP credentials required');
    const link = new URL(purpose === 'verify-email' ? '/verify-email' : '/reset-password', origin);
    link.searchParams.set('token', token);
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, requireTLS: !insecureTest && port !== 465,
      auth: insecureTest ? undefined : { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    });
    await transport.sendMail({
      from, to: email,
      subject: purpose === 'verify-email' ? 'Verify your BoxVault email' : 'Reset your BoxVault password',
      text: `Open this single-use link to ${purpose === 'verify-email' ? 'verify your email' : 'reset your password'}:\n${link.toString()}\n\nIf you did not request this, ignore this message.`,
    });
    transport.close();
  }

  async audit(kind: string, userId?: string) {
    // Strict allowlist: no token, email, address, payload or raw IP ever persisted.
    const kinds = new Set([
      'REGISTERED', 'EMAIL_VERIFIED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED',
      'GOOGLE_LOGIN', 'GOOGLE_FAILED', 'MFA_CHALLENGE_FAILED',
      'MFA_CHALLENGE_PASSED', 'MFA_ENROLLED', 'MFA_RECOVERY_USED',
      'MFA_DISABLED', 'MFA_RECOVERY_ROTATED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
      'SESSIONS_REVOKED', 'REFRESH_REPLAY_DETECTED', 'EMAIL_DELIVERY_FAILED', 'ADMIN_ACCESS_DENIED', 'ADMIN_ACCESS_GRANTED',
      'ADMIN_STEP_UP',
    ]);
    if (!kinds.has(kind)) throw new Error('Invalid audit event');
    await this.db.authAuditEvent.create({
      data: { kind, ...(userId ? { userId } : {}) },
    });
  }

  async eventsForUser(userId: string) {
    const events=await this.db.authAuditEvent.findMany({
      where: { userId },
      select: { kind: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });
    return { events };
  }

  tokenHash(token: string) { return this.hash('email-action:' + token); }
}
