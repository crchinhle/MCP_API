import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { jwtVerify, SignJWT } from 'jose';

import type {
  AuthPrincipal,
  IdentityUser,
  UserState,
} from './identity.types.js';

export interface PasswordRepository {
  activateCustomer(id: string): Promise<IdentityUser | null>;
  bumpSessionVersion(id: string, action?: string): Promise<void>;
  changeStateByAdmin(
    targetId: string,
    status: UserState,
    actorId: string,
    actorRole: string,
    reason: string,
  ): Promise<IdentityUser>;
  createCustomer(input: {
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<IdentityUser | null>;
  findByEmail(email: string): Promise<IdentityUser | null>;
  findById(id: string): Promise<IdentityUser | null>;
  listUsers(query?: string): Promise<IdentityUser[]>;
  recordFailedLogin(
    email: string,
    threshold: number,
    lockedUntil: Date,
  ): Promise<void>;
  touchLogin(id: string): Promise<void>;
  unlockExpired(id: string): Promise<IdentityUser | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateProfile(
    id: string,
    actorRole: string,
    fields: Record<string, string | null>,
  ): Promise<IdentityUser | null>;
}

export interface IdentityRedis {
  del(key: string): Promise<number>;
  eval(
    script: string,
    numKeys: number,
    ...args: (number | string)[]
  ): Promise<unknown>;
  expire(key: string, ttl: number): Promise<number>;
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
}

export interface IdentityTokenDelivery {
  sendLicensingActionVerification?(email: string, token: string, action: string): Promise<void>;
  sendEmailVerification(email: string, token: string): Promise<void>;
  sendPasswordReset(email: string, token: string): Promise<void>;
}

class NoopIdentityTokenDelivery implements IdentityTokenDelivery {
  sendLicensingActionVerification(): Promise<void> {
    return Promise.resolve();
  }

  sendEmailVerification(): Promise<void> {
    return Promise.resolve();
  }

  sendPasswordReset(): Promise<void> {
    return Promise.resolve();
  }
}

interface RefreshSession {
  familyId: string;
  id: string;
  version: number;
}

const REFRESH_TTL = 2_592_000;
const RESET_TTL = 3_600;
const VERIFY_TTL = 86_400;
const LOGIN_LIMIT = 10;
const RESET_LIMIT = 5;
const LOGIN_RATE_WINDOW = 60;
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_MILLISECONDS = 15 * 60 * 1_000;

@Injectable()
export class IdentityService {
  constructor(
    private readonly repo: PasswordRepository,
    private readonly redis: IdentityRedis,
    private readonly secret: Uint8Array,
    private readonly delivery: IdentityTokenDelivery = new NoopIdentityTokenDelivery(),
    private readonly accessTtl = 900,
  ) {}

  private digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async issueOneTime(
    namespace: string,
    value: string,
    ttl: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.set(`${namespace}:${this.digest(token)}`, value, 'EX', ttl);
    return token;
  }

  private async consume(
    namespace: string,
    token: string | undefined,
  ): Promise<string | null> {
    if (!token) return null;
    const key = `${namespace}:${this.digest(token)}`;
    const value = await this.redis.eval(
      "local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v",
      1,
      key,
    );
    return typeof value === 'string' ? value : null;
  }

  private async rateLimit(scope: string, subject: string, limit: number): Promise<void> {
    const key = `rate:${scope}:${this.digest(subject.toLowerCase())}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, LOGIN_RATE_WINDOW);
    if (count > limit) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many requests.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async register(input: {
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
    displayName: string;
    email: string;
    password: string;
  }) {
    const email = input.email.trim().toLowerCase();
    await this.rateLimit('register', email, 3);
    const user = await this.repo.createCustomer({
      customerType: input.customerType,
      displayName: input.displayName,
      email,
      passwordHash: await argon2.hash(input.password),
    });
    if (!user) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email is already registered.',
      });
    }
    const token = await this.issueOneTime('verify-email', user.id, VERIFY_TTL);
    await this.delivery.sendEmailVerification(user.email, token);
    return { accepted: true };
  }

  async resendVerification(emailValue: string): Promise<void> {
    const email = emailValue.trim().toLowerCase();
    await this.rateLimit('verify-resend', email, 3);
    const user = await this.repo.findByEmail(email);
    if (user?.role === 'CUSTOMER' && user.status === 'PENDING_EMAIL_VERIFICATION') {
      const token = await this.issueOneTime('verify-email', user.id, VERIFY_TTL);
      await this.delivery.sendEmailVerification(user.email, token);
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const id = await this.consume('verify-email', token);
    if (!id || !(await this.repo.activateCustomer(id))) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Verification token is invalid or expired.',
      });
    }
  }

  async issueLicensingActionVerification(userId: string, licenseId: string, action: string, deviceId?: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user || user.role !== 'CUSTOMER' || !user.emailVerifiedAt) {
      throw new UnauthorizedException({ code: 'EMAIL_NOT_VERIFIED', message: 'Email verification is required.' });
    }
    await this.rateLimit('licensing-action', `${userId}:${licenseId}:${action}`, 3);
    const token = await this.issueOneTime('licensing-action', JSON.stringify({ action, deviceId: deviceId ?? null, licenseId, userId }), 900);
    if (!this.delivery.sendLicensingActionVerification) throw new Error('LICENSING_ACTION_EMAIL_UNAVAILABLE');
    await this.delivery.sendLicensingActionVerification(user.email, token, action);
  }

  async resolveLicensingActionVerification(token: string | undefined, userId: string): Promise<{ action: string; deviceId: string | null; licenseId: string; expiresAt: string }> {
    if (!token) throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
    const key = `licensing-action:${this.digest(token)}`;
    const value = await this.redis.get(key);
    if (!value) throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
    try {
      const data = JSON.parse(value) as { action?: string; deviceId?: string | null; licenseId?: string; userId?: string; expiresAt?: string };
      if (data.userId !== userId || typeof data.action !== 'string' || typeof data.licenseId !== 'string') throw new Error('mismatch');
      return {
        action: data.action,
        deviceId: data.deviceId ?? null,
        licenseId: data.licenseId,
        // Redis TTL remains authoritative; this value is informational only.
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      };
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
    }
  }

  async consumeLicensingActionVerification(token: string | undefined, userId: string, licenseId: string, action: string, deviceId?: string): Promise<void> {
    if (!token) throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
    const key = `licensing-action:${this.digest(token)}`;
    const value = await this.redis.get(key);
    if (!value) throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
    try {
      const data = JSON.parse(value) as { action?: string; deviceId?: string | null; licenseId?: string; userId?: string };
      if (data.action !== action || data.deviceId !== (deviceId ?? null) || data.licenseId !== licenseId || data.userId !== userId) throw new Error('mismatch');
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
    }
    const consumed = await this.redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]); return 1; end; return 0",
      1,
      key,
      value,
    );
    if (Number(consumed) !== 1) throw new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN', message: 'The email verification token is invalid or expired.' });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.rateLimit('password-forgot', email, 3);
    const user = await this.repo.findByEmail(email);
    if (user && user.status !== 'DISABLED') {
      const token = await this.issueOneTime('reset', user.id, RESET_TTL);
      await this.delivery.sendPasswordReset(user.email, token);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.rateLimit('password-reset', token, RESET_LIMIT);
    const id = await this.consume('reset', token);
    if (!id) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Reset token is invalid or expired.',
      });
    }
    const user = await this.repo.findById(id);
    if (!user || user.role !== 'CUSTOMER' || user.status === 'DISABLED') {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Reset token is invalid or expired.',
      });
    }
    await this.repo.updatePassword(id, await argon2.hash(password));
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    password: string,
  ): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is invalid.',
      });
    }
    await this.repo.updatePassword(userId, await argon2.hash(password));
  }

  async verifyCurrentPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.repo.findById(userId);
    return Boolean(user && (await argon2.verify(user.passwordHash, password)));
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.rateLimit('login', normalizedEmail, LOGIN_LIMIT);
    let user = await this.repo.findByEmail(normalizedEmail);
    if (
      user?.status === 'LOCKED' &&
      user.lockedUntil &&
      user.lockedUntil.getTime() <= Date.now()
    ) {
      user = await this.repo.unlockExpired(user.id);
    }
    if (!user || user.status !== 'ACTIVE') {
      throw this.invalidCredentials();
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      await this.repo.recordFailedLogin(
        normalizedEmail,
        LOGIN_LOCK_THRESHOLD,
        new Date(Date.now() + LOGIN_LOCK_MILLISECONDS),
      );
      throw this.invalidCredentials();
    }
    await this.repo.touchLogin(user.id);
    return this.issue(user);
  }

  async issue(user: IdentityUser, familyId: string = randomUUID()) {
    const accessToken = await new SignJWT({
      role: user.role,
      sessionVersion: user.sessionVersion,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtl}s`)
      .sign(this.secret);
    const refreshToken = randomBytes(32).toString('base64url');
    const session: RefreshSession = {
      familyId,
      id: user.id,
      version: user.sessionVersion,
    };
    await this.redis.set(
      `refresh:${this.digest(refreshToken)}`,
      JSON.stringify(session),
      'EX',
      REFRESH_TTL,
    );
    return { accessToken, refreshToken, user: this.publicUser(user) };
  }

  private async consumeRefresh(raw: string | undefined): Promise<RefreshSession | null> {
    if (!raw) return null;
    const digest = this.digest(raw);
    const value = await this.redis.eval(
      "local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); redis.call('SET',KEYS[2],v,'EX',ARGV[1]); end; return v",
      2,
      `refresh:${digest}`,
      `refresh-used:${digest}`,
      REFRESH_TTL,
    );
    if (typeof value === 'string') return JSON.parse(value) as RefreshSession;
    const replay = await this.redis.get(`refresh-used:${digest}`);
    if (replay) {
      const session = JSON.parse(replay) as RefreshSession;
      await this.repo.bumpSessionVersion(session.id, 'SESSION_REVOKED_REPLAY');
      throw new UnauthorizedException({
        code: 'REFRESH_REUSE_DETECTED',
        message: 'Refresh token reuse was detected.',
      });
    }
    return null;
  }

  async refresh(raw: string | undefined) {
    const data = await this.consumeRefresh(raw);
    if (!data) throw this.invalidSession();
    const user = await this.repo.findById(data.id);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.sessionVersion !== data.version
    ) {
      if (user) await this.repo.bumpSessionVersion(data.id, 'SESSION_REVOKED_INVALID');
      throw this.invalidSession();
    }
    return this.issue(user, data.familyId);
  }

  async logout(raw: string | undefined): Promise<void> {
    try {
      const session = await this.consumeRefresh(raw);
      if (session) await this.repo.bumpSessionVersion(session.id, 'SESSION_REVOKED_LOGOUT');
    } catch (error) {
      if (error instanceof UnauthorizedException) return;
      throw error;
    }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.repo.bumpSessionVersion(userId, 'SESSION_REVOKED');
  }

  async authenticate(token: string): Promise<AuthPrincipal> {
    try {
      const result = await jwtVerify(token, this.secret);
      const user = await this.repo.findById(String(result.payload.sub));
      if (
        !user ||
        user.status !== 'ACTIVE' ||
        user.sessionVersion !== result.payload.sessionVersion
      ) {
        throw new Error('INVALID_SESSION');
      }
      return {
        role: user.role,
        sessionVersion: user.sessionVersion,
        sub: user.id,
      };
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }
  }

  async profile(id: string) {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }
    return this.publicUser(user);
  }

  async listUsers(query?: string) {
    return (await this.repo.listUsers(query)).map((user) => this.publicUser(user));
  }

  async updateProfile(
    actor: AuthPrincipal,
    fields: Record<string, string | null>,
  ) {
    const roleFields = new Set(['display_name', 'phone', 'address']);
    if (actor.role === 'PROVIDER_ADMIN') roleFields.add('organization_name');
    const allowed = Object.fromEntries(
      Object.entries(fields).filter(([key]) => roleFields.has(key)),
    );
    const user = await this.repo.updateProfile(actor.sub, actor.role, allowed);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }
    return this.publicUser(user);
  }

  async changeAccountState(
    targetId: string,
    status: UserState,
    actor: AuthPrincipal,
    reason: string,
  ) {
    if (actor.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'System Admin authority is required.',
      });
    }
    try {
      const user = await this.repo.changeStateByAdmin(
        targetId,
        status,
        actor.sub,
        actor.role,
        reason,
      );
      return this.publicUser(user);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'User was not found.',
        });
      }
      if (error instanceof Error && error.message === 'LAST_ACTIVE_SYSTEM_ADMIN') {
        throw new ConflictException({
          code: 'LAST_ACTIVE_SYSTEM_ADMIN',
          message: 'The last active System Admin cannot be disabled.',
        });
      }
      if (
        error instanceof Error &&
        error.message === 'INVALID_USER_STATE_TRANSITION'
      ) {
        throw new ConflictException({
          code: 'INVALID_USER_STATE_TRANSITION',
          message: 'The requested user state transition is not allowed.',
        });
      }
      throw error;
    }
  }

  publicUser(user: IdentityUser) {
    return {
      address: user.address,
      customerType: user.customerType,
      displayName: user.displayName,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      id: user.id,
      organizationName: user.organizationName,
      phone: user.phone,
      role: user.role,
      sessionVersion: user.sessionVersion,
      status: user.status,
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials.',
    });
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_SESSION',
      message: 'Invalid session.',
    });
  }
}
