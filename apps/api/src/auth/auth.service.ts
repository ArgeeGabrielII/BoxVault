import {
  BadRequestException, Injectable, OnModuleDestroy, ServiceUnavailableException,
  UnauthorizedException, ForbiddenException, HttpException, HttpStatus,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthHardeningService, normalizeEmail } from './auth-hardening.service';
import { OAuth2Client } from 'google-auth-library';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import {
  randomBytes, randomUUID, createHmac, createCipheriv, createDecipheriv, timingSafeEqual,
} from 'node:crypto';

const ISSUER = 'boxvault-api';
const AUDIENCE = 'boxvault';
const ACCESS_SECONDS = 600;
const CHALLENGE_MS = 5 * 60_000;
const REFRESH_MS = 14 * 24 * 60 * 60_000;
const FAIL = () => new UnauthorizedException('Invalid credentials');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function sha(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}
function base32(b: Buffer): string {
  let bits = 0, value = 0, result = '';
  for (const byte of b) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += ALPHABET[(value >>> (bits -= 5)) & 31];
    }
  }
  if (bits > 0) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}
function decode32(text: string): Buffer {
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const c of text.replace(/=+$/g, '').toUpperCase()) {
    const digit = ALPHABET.indexOf(c);
    if (digit === -1) throw FAIL();
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(output);
}
function totpAt(secret: string, step: number): string {
  const data = Buffer.alloc(8);
  data.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decode32(secret)).update(data).digest();
  const offset = digest[digest.length - 1] & 15;
  const numeric = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return numeric.toString().padStart(6, '0');
}
function matchStep(secret: string, code: string, last: bigint | null): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (let delta = -1; delta <= 1; delta++) {
    const step = BigInt(now + delta);
    if ((last === null || step > last) &&
        timingSafeEqual(Buffer.from(totpAt(secret, Number(step))), Buffer.from(code))) {
      return step;
    }
  }
  return null;
}
function encrypt(secret: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}
function decrypt(text: string, key: Buffer): string {
  const raw = Buffer.from(text, 'base64url');
  if (raw.length < 29) throw FAIL();
  const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}
export interface AccessPrincipal {
  userId: string;
  sessionId: string;
  mfaAuthenticatedAt: Date | null;
  verifiedAt: Date;
  privilegedStepUpAt: Date | null;
}
export interface IssuedSession {
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string; // Controller MUST send in HttpOnly cookie only.
}
@Injectable()
export class AuthService implements OnModuleDestroy {
  // Auth identity uses a distinct DB credential, not the RLS inventory credential.
  private readonly db: PrismaClient;
  private readonly google = new OAuth2Client();
  private readonly hardening: AuthHardeningService;

  private readonly fakeHash = argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });

  constructor(hardening: AuthHardeningService) {
    this.hardening = hardening;
    const url = process.env.AUTH_DATABASE_URL;
    this.db = new PrismaClient({
      datasources: { db: { url: url || 'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured' } },
    });
  }
  async onModuleDestroy(): Promise<void> { await this.db.$disconnect(); }
  private config() {
    const pepper = process.env.AUTH_SESSION_PEPPER;
    const jwtKey = process.env.AUTH_ACCESS_JWT_KEY;
    const enc = process.env.TOTP_ENCRYPTION_KEY;
    if (!process.env.AUTH_DATABASE_URL || !pepper || pepper.length < 32 ||
        !jwtKey || jwtKey.length < 32 || !enc ||
        Buffer.from(enc, 'base64').length !== 32) {
      throw new ServiceUnavailableException('Authentication is not configured');
    }
    return { pepper, key: new TextEncoder().encode(jwtKey), encryptionKey: Buffer.from(enc, 'base64') };
  }
  private async issue(userId: string, mfa: boolean): Promise<IssuedSession> {
    const cfg = this.config(), refreshToken = randomBytes(48).toString('base64url');
    const row = await this.db.authSession.create({
      data: {
        userId, refreshTokenHash: sha(cfg.pepper, refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_MS),
        mfaAuthenticatedAt: mfa ? new Date() : null,
      },
    });
    const accessToken = await new SignJWT({ sid: row.id, mfa })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId).setIssuer(ISSUER).setAudience(AUDIENCE)
      .setIssuedAt().setExpirationTime('10m')
      .sign(cfg.key);
    return { accessToken, accessExpiresIn: ACCESS_SECONDS, refreshToken };
  }
  async verifyAccess(bearer: string): Promise<AccessPrincipal> {
    const cfg = this.config();
    try {
      const { payload } = await jwtVerify(bearer, cfg.key, {
        issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'],
        clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(payload.sid)) throw FAIL();
      const row = await this.db.authSession.findUnique({ where: { id: payload.sid },
        include: { user: { select: { totpFactor: { select: { enabledAt: true } } } } },
      });
      if (!row || row.userId !== payload.sub || row.revokedAt || row.expiresAt <= new Date() ||
          (row.user.totpFactor?.enabledAt && (!row.mfaAuthenticatedAt || payload.mfa !== true))) throw FAIL();
      const elevated = typeof payload.stepUpAt === 'number' &&
        !!row.privilegedStepUpAt &&
        payload.stepUpAt === row.privilegedStepUpAt.getTime();
      return { userId: row.userId, sessionId: row.id,
        mfaAuthenticatedAt: row.mfaAuthenticatedAt, verifiedAt: new Date(),
        privilegedStepUpAt: elevated ? row.privilegedStepUpAt : null };
    } catch {
      throw FAIL();
    }
  }
  private async authenticated(userId: string) {
    const factor = await this.db.totpFactor.findUnique({ where: { userId } });
    const operator = await this.db.platformOperator.findUnique({ where: { userId } });
    if (operator?.enabled && !factor?.enabledAt)
      throw new ForbiddenException('Privileged account requires enrolled MFA');
    if (factor?.enabledAt) {
      const row = await this.db.authChallenge.create({
        data: { userId, expiresAt: new Date(Date.now() + CHALLENGE_MS) },
      });
      return { mfaRequired: true, challengeId: row.id, expiresIn: 300 };
    }
    const session = await this.issue(userId, false);
    return { mfaRequired: false, session };
  }
  async passwordLogin(email: unknown, password: unknown, ip: string) {
    if (typeof email !== 'string' || typeof password !== 'string' ||
        email.length > 254 || password.length > 1024 || !email.includes('@') || password.length < 1) throw FAIL();
    await this.hardening.limit('login', ip, email.trim().toLowerCase());
    this.config();
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const hash = user?.passwordHash ?? await this.fakeHash;
    let verified = false;
    try { verified = await argon2.verify(hash, password); } catch { /* fail closed */ }
    if (!user || !user.passwordHash || !verified || !user.emailVerifiedAt) {
      await this.hardening.audit('LOGIN_FAILED', user?.id);
      throw FAIL();
    }
    const result = await this.authenticated(user.id);
    await this.hardening.audit('LOGIN_SUCCEEDED', user.id);
    return result;
  }
  // Linking is explicit: an authenticated, recently established BoxVault session
  // plus a freshly verified Google ID token. Email equality does not link users.
  async linkGoogle(principal: AccessPrincipal, idToken: unknown) {
    const session = await this.db.authSession.findFirst({
      where: { id: principal.sessionId, userId: principal.userId, revokedAt: null },
    });
    if (!session || Date.now() - session.createdAt.getTime() > 10 * 60_000 ||
        (principal.mfaAuthenticatedAt && Date.now() - principal.mfaAuthenticatedAt.getTime() > 10 * 60_000))
      throw new ForbiddenException('Fresh authentication required');
    if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 12000) throw FAIL();
    const clients = [process.env.GOOGLE_WEB_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID]
      .filter((v): v is string => !!v);
    if (!clients.length) throw new ServiceUnavailableException('Google authentication not configured');
    let subject: string;
    try {
      const ticket = await this.google.verifyIdToken({ idToken, audience: clients });
      const claims = ticket.getPayload();
      if (!claims || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
          !claims.email_verified || !claims.sub || !claims.email) throw FAIL();
      subject = claims.sub;
    } catch { throw FAIL(); }
    try {
      await this.db.authIdentity.create({
        data: { userId: principal.userId, provider: 'GOOGLE', providerSubject: subject },
      });
    } catch { throw new ForbiddenException('Provider already linked'); }
    return { linked: true, provider: 'GOOGLE' as const };
  }

  async googleLogin(idToken: unknown, ip: string) {
    if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 12000) throw FAIL();
    await this.hardening.limit('google', ip);
    this.config();
    const clients = [process.env.GOOGLE_WEB_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID].filter(
      (v): v is string => !!v,
    );
    if (!clients.length) throw new ServiceUnavailableException('Google authentication not configured');
    let subject: string | undefined;
    try {
      const ticket = await this.google.verifyIdToken({ idToken, audience: clients });
      const claims = ticket.getPayload();
      if (!claims || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
          !claims.email_verified || !claims.sub || !claims.email) throw FAIL();
      subject = claims.sub;
    } catch { throw FAIL(); }
    const identity = await this.db.authIdentity.findUnique({
      where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: subject! } },
    });
    // Never silently merge password accounts by matching Google email.
    if (!identity) throw FAIL();
    const user = await this.db.user.findUnique({ where: { id: identity.userId } });
    if (!user?.emailVerifiedAt) throw FAIL();
    const result = await this.authenticated(identity.userId);
    await this.hardening.audit('GOOGLE_LOGIN', identity.userId);
    return result;
  }
  private async satisfyFactor(tx: Prisma.TransactionClient, userId: string, code: string,
    factor: { secretCiphertext: string; lastUsedStep: bigint | null }) {
    const cfg = this.config();
    let step: bigint | null = null;
    try { step = matchStep(decrypt(factor.secretCiphertext, cfg.encryptionKey), code, factor.lastUsedStep); }
    catch { throw FAIL(); }
    if (step !== null) {
      const updated = await tx.totpFactor.updateMany({
        where: { userId, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { lastUsedStep: step },
      });
      if (updated.count !== 1) throw FAIL();
      return;
    }
    const recovery = await tx.mfaRecoveryCode.findFirst({
      where: { userId, codeHash: sha(cfg.pepper, 'recovery:' + code), consumedAt: null },
    });
    if (!recovery) throw FAIL();
    const consumed = await tx.mfaRecoveryCode.updateMany({
      where: { id: recovery.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw FAIL();
  }
  async verifyChallenge(challengeId: unknown, code: unknown, ip: string) {
    if (typeof challengeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(challengeId) ||
        typeof code !== 'string' || code.length > 64) throw FAIL();
    await this.hardening.limit('mfa', ip, challengeId);
    this.config();
    // Count failed submissions OUTSIDE the factor-verification transaction:
    // otherwise a rollback on bad TOTP would restore the attempts counter.
    const attempt = await this.db.authChallenge.updateMany({
      where: { id: challengeId, consumedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count !== 1) throw FAIL();
    let userId: string;
    try {
      userId = await this.db.$transaction(async tx => {
        const challenge = await tx.authChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge || challenge.expiresAt <= new Date() || challenge.consumedAt ||
            challenge.attempts > 5) throw FAIL();
        const factor = await tx.totpFactor.findUnique({ where: { userId: challenge.userId } });
        if (!factor?.enabledAt) throw FAIL();
        await this.satisfyFactor(tx, challenge.userId, code, factor);
        const used = await tx.authChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (used.count !== 1) throw FAIL();
        return challenge.userId;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      await this.hardening.audit('MFA_CHALLENGE_FAILED');
      throw FAIL();
    }
    const session = await this.issue(userId, true);
    await this.hardening.audit('MFA_CHALLENGE_PASSED', userId);
    return session;
  }
  async refresh(refreshToken: unknown) {
    if (typeof refreshToken !== 'string' || !/^[a-zA-Z0-9_-]{64}$/.test(refreshToken)) throw FAIL();
    const cfg = this.config(), old = sha(cfg.pepper, refreshToken);
    // Distinguish an unknown forged token from a previously valid ROTATED token.
    // A replay revokes all active user sessions; do not throw inside the
    // transaction or the security revocation would be rolled back.
    let result: { session: IssuedSession } | { replayedUserId: string };
    try {
      result = await this.db.$transaction(async tx => {
        const row = await tx.authSession.findUnique({
          where: { refreshTokenHash: old },
          include: { user: { select: { totpFactor: { select: { enabledAt: true } } } } },
        });
        if (!row) {
          const spent = await tx.refreshTokenReuse.findUnique({ where: { tokenHash: old } });
          if (!spent || spent.expiresAt <= new Date()) throw FAIL();
          await tx.authSession.updateMany({
            where: { userId: spent.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          return { replayedUserId: spent.userId };
        }
        if (row.revokedAt || row.expiresAt <= new Date()) throw FAIL();
        if (row.user.totpFactor?.enabledAt && !row.mfaAuthenticatedAt) throw FAIL();
        const next = randomBytes(48).toString('base64url');
        const changed = await tx.authSession.updateMany({
          where: { id: row.id, refreshTokenHash: old, revokedAt: null },
          data: { refreshTokenHash: sha(cfg.pepper, next),
            privilegedStepUpAt: null },
        });
        if (changed.count !== 1) throw FAIL();
        await tx.refreshTokenReuse.create({
          data: { tokenHash: old, userId: row.userId,
            sessionId: row.id, expiresAt: row.expiresAt },
        });
        const accessToken = await new SignJWT({ sid: row.id, mfa: !!row.mfaAuthenticatedAt })
          .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
          .setSubject(row.userId).setIssuer(ISSUER).setAudience(AUDIENCE)
          .setIssuedAt().setExpirationTime('10m').sign(cfg.key);
        return { session: { accessToken, accessExpiresIn: ACCESS_SECONDS, refreshToken: next } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch { throw FAIL(); }
    if ('replayedUserId' in result) {
      await this.hardening.audit('REFRESH_REPLAY_DETECTED', result.replayedUserId);
      throw FAIL();
    }
    return result.session;
  }

  async logout(principal: AccessPrincipal) {
    await this.db.authSession.updateMany({
      where: { id: principal.sessionId, userId: principal.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.hardening.audit('SESSIONS_REVOKED', principal.userId);
  }
  async startTotp(principal: AccessPrincipal) {
    // Factor enrollment requires a newly issued / recently authenticated session.
    const session = await this.db.authSession.findFirst({
      where: { id: principal.sessionId, userId: principal.userId, revokedAt: null },
    });
    if (!session || Date.now() - session.createdAt.getTime() > 10 * 60_000) throw new ForbiddenException('Reauthentication required');
    const existing = await this.db.totpFactor.findUnique({ where: { userId: principal.userId } });
    if (existing?.enabledAt) throw new ForbiddenException('MFA already enabled');
    const secret = base32(randomBytes(20)), cfg = this.config();
    await this.db.totpFactor.upsert({
      where: { userId: principal.userId },
      create: { userId: principal.userId, secretCiphertext: encrypt(secret, cfg.encryptionKey),
        encryptionKeyId: 'v1', pendingExpiresAt: new Date(Date.now() + 10 * 60_000) },
      update: { secretCiphertext: encrypt(secret, cfg.encryptionKey),
        encryptionKeyId: 'v1', pendingExpiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    return { provisioningUri: 'otpauth://totp/' +
      encodeURIComponent('BoxVault:' + principal.userId) + '?secret=' + secret +
      '&issuer=BoxVault&algorithm=SHA1&digits=6&period=30', expiresIn: 600 };
  }
  async confirmTotp(principal: AccessPrincipal, code: unknown) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new BadRequestException('Invalid verification code');
    const cfg = this.config(), codes = Array.from({ length: 10 }, () => randomBytes(12).toString('hex'));
    try {
      await this.db.$transaction(async tx => {
        const factor = await tx.totpFactor.findUnique({ where: { userId: principal.userId } });
        if (!factor || factor.enabledAt || !factor.pendingExpiresAt || factor.pendingExpiresAt <= new Date()) throw FAIL();
        const step = matchStep(decrypt(factor.secretCiphertext, cfg.encryptionKey), code, null);
        if (step === null) throw FAIL();
        const active = await tx.totpFactor.updateMany({
          where: { userId: principal.userId, enabledAt: null, pendingExpiresAt: { gt: new Date() } },
          data: { enabledAt: new Date(), pendingExpiresAt: null, lastUsedStep: step },
        });
        if (active.count !== 1) throw FAIL();
        await tx.mfaRecoveryCode.deleteMany({ where: { userId: principal.userId } });
        await tx.mfaRecoveryCode.createMany({ data: codes.map(c => ({
          userId: principal.userId, codeHash: sha(cfg.pepper, 'recovery:' + c),
        })) });
        // Enrollment invalidates previous sessions; login again using TOTP.
        await tx.authSession.updateMany({
          where: { userId: principal.userId, revokedAt: null }, data: { revokedAt: new Date() },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch { throw FAIL(); }
    await this.hardening.audit('MFA_ENROLLED', principal.userId);
    return { recoveryCodes: codes, reloginRequired: true };
  }
  /**
   * Registration is intentionally identity-only until verified email is proven.
   * The personal tenant is provisioned by a narrowly granted SECURITY DEFINER
   * function after verification, never by the content runtime connection.
   */
  async register(emailInput: unknown, passwordInput: unknown, ip: string) {
    const email = normalizeEmail(emailInput);
    if (!email || typeof passwordInput !== 'string' ||
        passwordInput.length < 12 || passwordInput.length > 128 ||
        !/[A-Z]/.test(passwordInput) || !/[a-z]/.test(passwordInput) ||
        !/[0-9]/.test(passwordInput)) {
      throw new BadRequestException('Invalid registration details');
    }
    this.config();
    this.hardening.assertMailerConfigured();
    await this.hardening.limit('register', ip, email);
    const existing = await this.db.user.findUnique({
      where: { email }, select: { id: true, emailVerifiedAt: true },
    });
    if (existing?.emailVerifiedAt) return { accepted: true };
    let userId: string;
    if (existing) userId = existing.id;
    else {
      // Never log or return raw user email on errors.
      const passwordHash = await argon2.hash(passwordInput, { type: argon2.argon2id });
      try {
        const created = await this.db.user.create({ data: { email, passwordHash } });
        userId = created.id;
      } catch { return { accepted: true }; }
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hardening.tokenHash(token);
    await this.db.emailActionToken.create({
      data: { userId, kind: 'VERIFY_EMAIL', tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    try { await this.hardening.email(email, 'verify-email', token); }
    catch { await this.hardening.audit('EMAIL_DELIVERY_FAILED', userId); }
    await this.hardening.audit('REGISTERED', userId);
    return { accepted: true };
  }

  async verifyEmail(token: unknown, password: unknown) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
        typeof password !== 'string' || password.length < 12 || password.length > 128 ||
        !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
      throw FAIL();
    this.config();
    // The recipient supplies a fresh password: the unverified registration
    // password can never be used for account takeover.
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const digest = this.hardening.tokenHash(token);
    const userId = await this.db.$transaction(async tx => {
      const row = await tx.emailActionToken.findUnique({ where: { tokenHash: digest } });
      if (!row || row.kind !== 'VERIFY_EMAIL' || row.usedAt || row.expiresAt <= new Date()) throw FAIL();
      const consumed = await tx.emailActionToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw FAIL();
      await tx.user.update({ where: { id: row.userId },
        data: { emailVerifiedAt: new Date(), passwordHash } });
      // The definer function checks verified email and serializes onboarding.
      await tx.$queryRaw`SELECT security.bootstrap_personal_tenant(
        ${row.userId}::uuid, ${randomUUID()}::uuid, ${randomUUID()}::uuid
      )::text AS provisioned`;
      return row.userId;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.hardening.audit('EMAIL_VERIFIED', userId);
    return { verified: true };
  }

  async requestPasswordReset(emailInput: unknown, ip: string) {
    const email = normalizeEmail(emailInput);
    await this.hardening.limit('reset', ip, email || undefined);
    this.config();
    this.hardening.assertMailerConfigured();
    if (!email) return { accepted: true };
    const user = await this.db.user.findUnique({ where: { email } });
    if (user?.passwordHash && user.emailVerifiedAt) {
      const token = randomBytes(32).toString('base64url');
      await this.db.emailActionToken.create({
        data: { userId: user.id, kind: 'RESET_PASSWORD',
          tokenHash: this.hardening.tokenHash(token),
          expiresAt: new Date(Date.now() + 15 * 60_000) },
      });
      try { await this.hardening.email(email, 'reset-password', token); }
      catch { await this.hardening.audit('EMAIL_DELIVERY_FAILED', user.id); }
      await this.hardening.audit('PASSWORD_RESET_REQUESTED', user.id);
    }
    return { accepted: true };
  }

  async resetPassword(token: unknown, newPassword: unknown) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
        typeof newPassword !== 'string' || newPassword.length < 12 ||
        newPassword.length > 128 || !/[A-Z]/.test(newPassword) ||
        !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) throw FAIL();
    this.config();
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const digest = this.hardening.tokenHash(token);
    const userId = await this.db.$transaction(async tx => {
      const row = await tx.emailActionToken.findUnique({ where: { tokenHash: digest } });
      if (!row || row.kind !== 'RESET_PASSWORD' || row.usedAt || row.expiresAt <= new Date()) throw FAIL();
      const consumed = await tx.emailActionToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw FAIL();
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
      await tx.authSession.updateMany({ where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() } });
      await tx.emailActionToken.updateMany({
        where: { userId: row.userId, kind: 'RESET_PASSWORD', usedAt: null },
        data: { usedAt: new Date() },
      });
      return row.userId;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.hardening.audit('PASSWORD_RESET_COMPLETED', userId);
    return { changed: true, reloginRequired: true };
  }

  async disableTotp(principal: AccessPrincipal, password: unknown, code: unknown) {
    if (typeof password !== 'string' || typeof code !== 'string' || code.length > 64) throw FAIL();
    // Deliberately require live password reauthentication in addition to active
    // access; provider-only identities need reviewed recovery path.
    const user = await this.db.user.findUnique({ where: { id: principal.userId } });
    if (!user?.passwordHash || !await argon2.verify(user.passwordHash, password)) throw FAIL();
    const operator = await this.db.platformOperator.findUnique({ where: { userId: principal.userId } });
    if (operator?.enabled) throw new ForbiddenException('Operator MFA must remain enabled');
    await this.db.$transaction(async tx => {
      const factor = await tx.totpFactor.findUnique({ where: { userId: principal.userId } });
      if (!factor?.enabledAt) throw FAIL();
      await this.satisfyFactor(tx, principal.userId, code, factor);
      await tx.totpFactor.delete({ where: { userId: principal.userId } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: principal.userId } });
      await tx.authSession.updateMany({ where: { userId: principal.userId, revokedAt: null },
        data: { revokedAt: new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.hardening.audit('MFA_DISABLED', principal.userId);
    return { disabled: true, reloginRequired: true };
  }

  async adminAccess(principal: AccessPrincipal) {
    const operator = await this.db.platformOperator.findUnique({
      where: { userId: principal.userId },
    });
    const factor = await this.db.totpFactor.findUnique({ where: { userId: principal.userId } });
    const user = await this.db.user.findUnique({ where: { id: principal.userId } });
    const activeSession = await this.db.authSession.findUnique({ where: { id: principal.sessionId } });
    if (!operator?.enabled || !factor?.enabledAt || !user?.emailVerifiedAt ||
        !principal.mfaAuthenticatedAt ||
        !activeSession?.privilegedStepUpAt || !principal.privilegedStepUpAt ||
        principal.privilegedStepUpAt.getTime() !== activeSession.privilegedStepUpAt.getTime() ||
        Date.now() - activeSession.privilegedStepUpAt.getTime() > 5 * 60_000) {
      await this.hardening.audit('ADMIN_ACCESS_DENIED', principal.userId);
      throw new ForbiddenException('Privileged MFA and step-up required');
    }
    await this.hardening.audit('ADMIN_ACCESS_GRANTED', principal.userId);
    return operator.role;
  }

  async adminStepUp(principal: AccessPrincipal, code: unknown) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw FAIL();
    const operator = await this.db.platformOperator.findUnique({ where: { userId: principal.userId } });
    if (!operator?.enabled) throw new ForbiddenException();
    const cfg = this.config();
    const now = new Date();
    const step = await this.db.$transaction(async tx => {
      const factor = await tx.totpFactor.findUnique({ where: { userId: principal.userId } });
      if (!factor?.enabledAt) throw FAIL();
      const step = matchStep(decrypt(factor.secretCiphertext, cfg.encryptionKey), code, factor.lastUsedStep);
      if (step === null) throw FAIL();
      const updated = await tx.totpFactor.updateMany({
        where: { userId: principal.userId,
          OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { lastUsedStep: step },
      });
      if (updated.count !== 1) throw FAIL();
      const refreshed = await tx.authSession.updateMany({
        where: { id: principal.sessionId, userId: principal.userId, revokedAt: null,
          expiresAt: { gt: now } },
        data: { mfaAuthenticatedAt: now, privilegedStepUpAt: now },
      });
      if (refreshed.count !== 1) throw FAIL();
      return step;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    void step;
    const accessToken = await new SignJWT({ sid: principal.sessionId, mfa: true,
      stepUpAt: now.getTime() })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(principal.userId)
      .setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt()
      .setExpirationTime('10m').sign(cfg.key);
    await this.hardening.audit('ADMIN_STEP_UP', principal.userId);
    return { accessToken, accessExpiresIn: ACCESS_SECONDS, tokenType: 'Bearer' };
  }

  async rotateRecoveryCodes(principal: AccessPrincipal, password: unknown, code: unknown) {
    if (typeof password !== 'string' || typeof code !== 'string' || code.length > 64) throw FAIL();
    const user = await this.db.user.findUnique({ where: { id: principal.userId } });
    if (!user?.passwordHash || !await argon2.verify(user.passwordHash, password)) throw FAIL();
    const cfg = this.config();
    const codes = Array.from({ length: 10 }, () => randomBytes(12).toString('hex'));
    await this.db.$transaction(async tx => {
      const factor = await tx.totpFactor.findUnique({ where: { userId: principal.userId } });
      if (!factor?.enabledAt) throw FAIL();
      await this.satisfyFactor(tx, principal.userId, code, factor);
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: principal.userId } });
      await tx.mfaRecoveryCode.createMany({
        data: codes.map(c => ({ userId: principal.userId,
          codeHash: sha(cfg.pepper, 'recovery:' + c) })),
      });
      await tx.authSession.updateMany({
        where: { userId: principal.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.hardening.audit('MFA_RECOVERY_ROTATED', principal.userId);
    return { recoveryCodes: codes, reloginRequired: true };
  }

  async listSessions(principal: AccessPrincipal) {
    const sessions = await this.db.authSession.findMany({
      where: { userId: principal.userId },
      select: { id: true, createdAt: true, expiresAt: true, revokedAt: true,
        mfaAuthenticatedAt: true },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    return { sessions };
  }

  async revokeSession(principal: AccessPrincipal, sessionId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw FAIL();
    const result = await this.db.authSession.updateMany({
      where: { userId: principal.userId, id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.hardening.audit('SESSIONS_REVOKED', principal.userId);
    return { revoked: result.count === 1 };
  }

  async revokeOtherSessions(principal: AccessPrincipal) {
    const { count } = await this.db.authSession.updateMany({
      where: { userId: principal.userId, id: { not: principal.sessionId },
        revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.hardening.audit('SESSIONS_REVOKED', principal.userId);
    return { revokedCount: count };
  }

}
