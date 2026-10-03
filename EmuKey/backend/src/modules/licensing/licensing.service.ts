import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { recoverMessageAddress, type Hex } from 'viem';
import { jwtVerify, SignJWT } from 'jose';
import type { Redis } from 'ioredis';

import { activationCommitment } from '../../platform/crypto/license-crypto.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import type { IdentityService } from '../identity-access/identity.service.js';
import type { ActivationEnvelopePort } from '../blockchain/application/ports/activation-envelope.port.js';
import type { LicenseProjectionRepository } from '../blockchain/infrastructure/license-projection.repository.js';
import type {
  LicenseCommandConfig,
  LicensingRepository,
} from './infrastructure/licensing.repository.js';
import type {
  ActivateDeviceDto,
  ActivationKeyRecoveryDto,
  ActivationChallengeDto,
  LicenseLifecycleDto,
  RevokeDeviceDto,
  RemoteRevokeDeviceDto,
  RotateActivationKeyDto,
  LicensingActionVerificationDto,
} from './licensing.dto.js';

const CHALLENGE_TTL = 300;
const ENTITLEMENT_TTL_SECONDS = 300;
const ENTITLEMENT_AUDIENCE = 'emukey-license-client';
const ENTITLEMENT_ISSUER = 'emukey-licensing';

export class LicensingService {
  constructor(
    private readonly repository: LicensingRepository,
    private readonly projection: LicenseProjectionRepository,
    private readonly envelopes: ActivationEnvelopePort,
    private readonly redis: Redis,
    private readonly jwtSecret: Uint8Array,
    private readonly chain: LicenseCommandConfig,
    private readonly identity?: IdentityService,
  ) {}

  async resolveActionVerification(actor: AuthPrincipal, token: string) {
    this.requireCustomer(actor);
    const resolved = await this.identity?.resolveLicensingActionVerification(token, actor.sub);
    if (!resolved) throw new UnauthorizedException({ code: 'IDENTITY_SERVICE_UNAVAILABLE' });
    const license = await this.repository.findSecurity(resolved.licenseId, actor.sub);
    if (!license) this.notFound();
    if (resolved.deviceId && !(await this.repository.findDeviceById(resolved.licenseId, resolved.deviceId))) this.notFound();
    return resolved;
  }

  async requestActionVerification(actor: AuthPrincipal, dto: LicensingActionVerificationDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(dto.licenseId, actor.sub);
    if (!license) this.notFound();
    if (dto.action === 'REVOKE_DEVICE' || dto.action === 'REMOTE_REVOKE_DEVICE') {
      if (!dto.deviceId || !(await this.repository.findDeviceById(dto.licenseId, dto.deviceId))) {
        this.notFound();
      }
    }
    if (!this.identity) throw new Error('IDENTITY_SERVICE_UNAVAILABLE');
    await this.identity.issueLicensingActionVerification(actor.sub, dto.licenseId, dto.action, dto.deviceId);
    return { accepted: true };
  }

  async commandStatus(actor: AuthPrincipal, commandId: string) {
    const result = await this.repository.commandStatus(actor.sub, commandId);
    if (!result) this.notFound();
    return result;
  }

  async challenge(actor: AuthPrincipal | null, dto: ActivationChallengeDto) {
    const { purpose } = dto;
    let license: Awaited<ReturnType<LicensingRepository['findSecurity']>>;
    if (purpose === 'ACTIVATE_DEVICE') {
      if (!dto.activationKey) this.invalidActivationCredential();
      license = await this.repository.findActivationLicense(activationCommitment(dto.activationKey));
      if (!license) this.invalidActivationCredential();
    } else if (purpose === 'ISSUE_ENTITLEMENT' || purpose === 'REFRESH_ENTITLEMENT') {
      if (!dto.licenseId) this.notFound();
      license = await this.repository.findSecurity(dto.licenseId);
      if (!license) this.notFound();
    } else {
      if (!actor) throw new UnauthorizedException();
      this.requireCustomer(actor);
      if (!dto.licenseId) this.notFound();
      license = await this.repository.findSecurity(dto.licenseId, actor.sub);
      if (!license) this.notFound();
    }
    return this.issueChallenge(license, { ...dto, licenseId: license.id });
  }

  private async issueChallenge(
    license: NonNullable<Awaited<ReturnType<LicensingRepository['findSecurity']>>>,
    dto: ActivationChallengeDto & { licenseId: string },
  ) {
    const { deviceId, deviceRef, licenseId, purpose } = dto;
    this.requireActive(license.status, license.expiresAt);
    const device = deviceId ? await this.repository.findDeviceById(licenseId, deviceId) : null;
    if (deviceId && !device) this.notFound();
    if (purpose === 'ACTIVATE_DEVICE' && deviceId) {
      throw new ConflictException({ code: 'INVALID_CHALLENGE_SUBJECT', message: 'Activation challenges must not target an existing device id.' });
    }
    if (purpose !== 'ACTIVATE_DEVICE' && !device) {
      throw new ConflictException({ code: 'INVALID_CHALLENGE_SUBJECT', message: 'This challenge purpose requires an existing device.' });
    }
    const opaqueDeviceRef = device?.deviceRef ?? this.opaqueDeviceRef(deviceRef);
    const existing = device ?? await this.repository.findDevice(licenseId, opaqueDeviceRef);
    const bindingGeneration = existing
      ? existing.bindingGeneration + (purpose === 'ACTIVATE_DEVICE' && existing.status === 'REVOKED' ? 1 : 0)
      : 1;
    const expiresAtEpoch = Math.floor(Date.now() / 1_000) + CHALLENGE_TTL;
    const challenge = `emukey:v1:${purpose}:${licenseId}:${opaqueDeviceRef}:${bindingGeneration}:${license.activationKeyVersion}:${expiresAtEpoch}:${randomBytes(24).toString('base64url')}`;
    const key = this.challengeKey(licenseId, opaqueDeviceRef, purpose, bindingGeneration, license.activationKeyVersion);
    await this.redis.set(key, challenge, 'EX', CHALLENGE_TTL);
    return { bindingGeneration, challenge, expiresAt: new Date(expiresAtEpoch * 1_000).toISOString(), keyVersion: license.activationKeyVersion, licenseId, purpose };
  }

  async activate(actor: AuthPrincipal | null, dto: ActivateDeviceDto) {
    const license = await this.repository.findActivationLicense(activationCommitment(dto.activationKey));
    if (!license) this.invalidActivationCredential();
    this.verifyBearerKey(dto.activationKey, license.activationCommitment);
    this.requireActive(license.status, license.expiresAt);
    const opaqueDeviceRef = this.opaqueDeviceRef(dto.deviceRef);
    const existing = await this.repository.findDevice(license.id, opaqueDeviceRef);
    const bindingGeneration = existing
      ? existing.bindingGeneration + (existing.status === 'REVOKED' ? 1 : 0)
      : 1;
    await this.verifyDeviceProof(license.id, opaqueDeviceRef, 'ACTIVATE_DEVICE', bindingGeneration, license.activationKeyVersion, dto.challenge, dto.proof, dto.devicePublicKey);
    const deviceId = randomUUID();
    try {
      const result = await this.repository.createDeviceCommand(null, license.id, opaqueDeviceRef, dto.devicePublicKey, deviceId, bindingGeneration, this.chain);
      const device = await this.repository.findDeviceById(license.id, result.deviceId ?? deviceId);
       return {
         activatedAt: device?.activatedAt instanceof Date ? device.activatedAt.toISOString() : new Date().toISOString(),
         bindingGeneration: device?.bindingGeneration ?? bindingGeneration,
         deviceRef: opaqueDeviceRef,
         id: device?.id ?? deviceId,
          licenseId: license.id,

        revokedAt: null,
        status: 'ACTIVE',
      };
    } catch (error) {
      this.translate(error);
    }
  }

  async revokeDevice(actor: AuthPrincipal, licenseId: string, deviceId: string, dto: RevokeDeviceDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId, actor.sub);
    const device = await this.repository.findDeviceById(licenseId, deviceId);
    if (!license || !device) this.notFound();
    this.verifyBearerKey(dto.activationKey, license.activationCommitment);
    await this.verifyDeviceProof(licenseId, device.deviceRef, 'SELF_REVOKE_DEVICE', device.bindingGeneration, license.activationKeyVersion, dto.challenge, dto.proof, device.devicePublicKey);
     await this.consumeActionToken(actor, dto.actionToken, licenseId, 'REVOKE_DEVICE', deviceId);
     try {
       await this.repository.createDeviceRevokeCommand(actor.sub, licenseId, device.deviceRef, device.id, device.bindingGeneration, this.chain);
       return {
         activatedAt: (device as { activatedAt?: unknown }).activatedAt instanceof Date ? (device as { activatedAt: Date }).activatedAt.toISOString() : null,
          bindingGeneration: device.bindingGeneration,
          deviceRef: device.deviceRef,
         id: device.id,
         licenseId,
         revokedAt: new Date().toISOString(),
         status: 'REVOKED',
       };
    } catch (error) {
      this.translate(error);
    }
  }

  async remoteRevokeDevice(actor: AuthPrincipal, licenseId: string, deviceId: string, dto: RemoteRevokeDeviceDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId, actor.sub);
    const device = await this.repository.findDeviceById(licenseId, deviceId);
    if (!license || !device) this.notFound();
     await this.verifyPasswordReauth(actor.sub, dto.currentPassword);
     await this.consumeActionToken(actor, dto.actionToken, licenseId, 'REMOTE_REVOKE_DEVICE', deviceId);
     try {
       await this.repository.createDeviceRevokeCommand(actor.sub, licenseId, device.deviceRef, device.id, device.bindingGeneration, this.chain);
       return {
         activatedAt: (device as { activatedAt?: unknown }).activatedAt instanceof Date ? (device as { activatedAt: Date }).activatedAt.toISOString() : null,
          bindingGeneration: device.bindingGeneration,
          deviceRef: device.deviceRef,
         id: device.id,
         licenseId,
         revokedAt: new Date().toISOString(),
         status: 'REVOKED',
       };
     } catch (error) {
       this.translate(error);
     }
  }

  async rotate(actor: AuthPrincipal, licenseId: string, dto: RotateActivationKeyDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId, actor.sub);
    if (!license) this.notFound();
    this.requireActive(license.status, license.expiresAt);
    this.verifyBearerKey(dto.currentKey, license.activationCommitment);
    await this.consumeActionToken(actor, dto.actionToken, licenseId, 'ROTATE_KEY');
    const secret: `0x${string}` = `0x${randomBytes(32).toString('hex')}`;
    const commitment = activationCommitment(secret);
    const command = await this.repository.createRotationCommand(actor.sub, licenseId, commitment, license.activationKeyVersion + 1, this.chain);
    if (!command.reused) {
      await this.envelopes.prepare({
        commandId: command.commandId,
        commitment,
        keyVersion: license.activationKeyVersion + 1,
        licenseId,
        secret,
      }, 86_400);
    }
    return {
      commandId: command.commandId,
      deviceId: command.deviceId,
      licenseId: command.licenseId,
      status: command.status,
    };
  }

  async recoverActivationKey(actor: AuthPrincipal, licenseId: string, dto: ActivationKeyRecoveryDto) {
    this.requireCustomer(actor);
    const license = await this.repository.findSecurity(licenseId, actor.sub);
    if (!license) this.notFound();
    this.requireActive(license.status, license.expiresAt);
    await this.verifyPasswordReauth(actor.sub, dto.currentPassword);
    await this.consumeActionToken(actor, dto.actionToken, licenseId, 'KEY_RECOVERY');
    const secret: `0x${string}` = `0x${randomBytes(32).toString('hex')}`;
    const commitment = activationCommitment(secret);
    const command = await this.repository.createRotationCommand(
      actor.sub,
      licenseId,
      commitment,
      license.activationKeyVersion + 1,
      this.chain,
    );
    if (!command.reused) {
      await this.envelopes.prepare({
        commandId: command.commandId,
        commitment,
        keyVersion: license.activationKeyVersion + 1,
        licenseId,
        secret,
      }, 86_400);
    }
    return {
      commandId: command.commandId,
      deviceId: command.deviceId,
      licenseId: command.licenseId,
      status: command.status,
    };
  }

  async lifecycle(actor: AuthPrincipal, licenseId: string, dto: LicenseLifecycleDto) {
    if (actor.role !== 'PROVIDER_ADMIN') throw new ForbiddenException();
    try {
      return await this.repository.createLifecycleCommand(actor.sub, licenseId, dto.command, this.chain, dto.reason);
    } catch (error) {
      this.translate(error);
    }
  }

  async issueEntitlement(actor: AuthPrincipal | null, dto: import('./licensing.dto.js').EntitlementRefreshDto) {
    return this.signEntitlement(dto, 'ISSUE_ENTITLEMENT');
  }

  async refreshEntitlement(actor: AuthPrincipal | null, dto: import('./licensing.dto.js').EntitlementRefreshDto) {
    return this.signEntitlement(dto, 'REFRESH_ENTITLEMENT');
  }

  async verifyEntitlement(
    actor: AuthPrincipal | null,
    dto: import('./licensing.dto.js').EntitlementVerifyDto,
  ) {
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(dto.token, this.jwtSecret, {
        algorithms: ['HS256'],
        audience: ENTITLEMENT_AUDIENCE,
        issuer: ENTITLEMENT_ISSUER,
      }));
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ENTITLEMENT',
        message: 'The entitlement token is invalid or expired.',
      });
    }
    const { bindingGeneration, deviceId, entitlementVersion, exp, keyVersion, licenseId, rights } = payload;
    if (
      typeof deviceId !== 'string' ||
      typeof entitlementVersion !== 'number' ||
      typeof exp !== 'number' ||
       typeof keyVersion !== 'number' ||
       typeof bindingGeneration !== 'number' ||
       typeof licenseId !== 'string' ||
      typeof rights !== 'object' ||
      rights === null ||
      Array.isArray(rights)
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_ENTITLEMENT',
        message: 'The entitlement token has an invalid payload.',
      });
    }
    const context = await this.projection.entitlementContext(
      licenseId,
      deviceId,
    );
    if (
      !context ||
      context.status !== 'ACTIVE' ||
       context.deviceStatus !== 'ACTIVE' ||
       context.licenseFinality !== 'CONFIRMED' ||
      context.expiresAt.getTime() <= Date.now() ||
      context.entitlementVersion !== entitlementVersion ||
       context.keyVersion !== keyVersion ||
       context.bindingGeneration !== bindingGeneration
     ) {
      throw new ConflictException({
        code: 'ENTITLEMENT_INVALIDATED',
        message: 'The entitlement was invalidated by the current on-chain license state.',
      });
    }
    return {
      bindingGeneration,
      deviceId,
      entitlementVersion,
      expiresAt: new Date(exp * 1_000).toISOString(),
      keyVersion,
      licenseId,
      rights: rights as Record<string, unknown>,
      valid: true as const,
    };
  }

  private async signEntitlement(dto: import('./licensing.dto.js').EntitlementRefreshDto, purpose: 'ISSUE_ENTITLEMENT' | 'REFRESH_ENTITLEMENT') {
    const { licenseId, deviceId } = dto;
    const context = await this.projection.entitlementContext(licenseId, deviceId);
    if (!context) this.notFound();
     if (context.status !== 'ACTIVE' || context.deviceStatus !== 'ACTIVE' || context.licenseFinality !== 'CONFIRMED' || context.expiresAt.getTime() <= Date.now()) {
       throw new ConflictException({ code: 'ENTITLEMENT_NOT_AVAILABLE', message: 'License must be chain-confirmed and the device must be active in PostgreSQL.' });
     }
    const device = await this.repository.findDeviceById(licenseId, deviceId);
    if (!device) this.notFound();
    await this.verifyDeviceProof(licenseId, device.deviceRef, purpose, device.bindingGeneration, context.keyVersion, dto.challenge, dto.proof, device.devicePublicKey);
    const expiresAt = new Date(Math.min(context.expiresAt.getTime(), Date.now() + ENTITLEMENT_TTL_SECONDS * 1_000));
    const token = await new SignJWT({
      deviceId,
      entitlementVersion: context.entitlementVersion,
      keyVersion: context.keyVersion,
       bindingGeneration: context.bindingGeneration,
       licenseId,
       rights: context.entitlements,
     })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience(ENTITLEMENT_AUDIENCE)
      .setIssuer(ENTITLEMENT_ISSUER)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
      .sign(this.jwtSecret);
    return { token, expiresAt: expiresAt.toISOString(), licenseId, deviceId, entitlementVersion: context.entitlementVersion };
  }

  private invalidActivationCredential(): never {
    throw new UnauthorizedException({ code: 'INVALID_ACTIVATION_KEY', message: 'The activation credential is invalid or cannot be used.' });
  }

  private verifyBearerKey(value: string, expected: Hex) {
    try {
      if (activationCommitment(value as `0x${string}`) !== expected) {
        throw new Error('INVALID_LICENSE_KEY');
      }
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_LICENSE_KEY', message: 'The activation key is invalid.' });
    }
  }

  private async verifyDeviceProof(licenseId: string, deviceRef: string, purpose: string, bindingGeneration: number, keyVersion: number, challenge: string, proof: string, expectedAddress: string) {
    const key = this.challengeKey(licenseId, deviceRef, purpose, bindingGeneration, keyVersion);
    const stored = await this.redis.get(key);
    if (!stored || stored !== challenge) throw new UnauthorizedException({ code: 'INVALID_DEVICE_CHALLENGE', message: 'The device challenge is invalid or expired.' });
    const recovered = await recoverMessageAddress({ message: challenge, signature: proof as `0x${string}` });
    if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) throw new UnauthorizedException({ code: 'INVALID_DEVICE_PROOF', message: 'The device proof is invalid.' });
    const consumed = await this.redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]); return 1; end; return 0",
      1,
      key,
      challenge,
    );
    if (Number(consumed) !== 1) throw new UnauthorizedException({ code: 'INVALID_DEVICE_CHALLENGE', message: 'The device challenge is invalid or expired.' });
  }

  private async consumeActionToken(actor: AuthPrincipal, token: string, licenseId: string, action: string, deviceId?: string) {
    if (!this.identity) throw new Error('IDENTITY_SERVICE_UNAVAILABLE');
    await this.identity.consumeLicensingActionVerification(token, actor.sub, licenseId, action, deviceId);
  }

  private async verifyPasswordReauth(userId: string, password: string) {
    if (!this.identity || !(await this.identity.verifyCurrentPassword(userId, password))) {
      throw new UnauthorizedException({
        code: 'INVALID_PASSWORD_REAUTH',
        message: 'Recent password re-authentication is required.',
      });
    }
  }

  private opaqueDeviceRef(deviceRef: string): string {
    return createHmac('sha256', this.jwtSecret).update(`device-ref:${deviceRef}`).digest('hex');
  }

  private challengeKey(licenseId: string, deviceRef: string, purpose: string, bindingGeneration: number, keyVersion: number) {
    return `nonce:activation:${licenseId}:${createHash('sha256').update(deviceRef).digest('hex')}:${purpose}:${bindingGeneration}:${keyVersion}`;
  }

  private requireCustomer(actor: AuthPrincipal) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
  }

  private requireActive(status: string, expiresAt: Date) {
    if (status !== 'ACTIVE' || expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'LICENSE_NOT_ACTIVE', message: 'The license is not active.' });
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'LICENSE_NOT_FOUND', message: 'License was not found.' });
  }

  private translate(error: unknown): never {
    const code = error instanceof Error ? error.message : 'LICENSING_OPERATION_FAILED';
    if (['LICENSE_NOT_FOUND', 'LICENSE_NOT_CUSTOMER_OWNED', 'LICENSE_NOT_PROVIDER_OWNED', 'DEVICE_NOT_FOUND'].includes(code)) this.notFound();
    if (
      code.includes('already has an unresolved chain command') ||
      code.includes('Forward ChainCommand') ||
      code.includes('unresolved recovery suffix') ||
      ['DEVICE_ACTIVATION_PENDING', 'DEVICE_ALREADY_ACTIVE', 'DEVICE_NOT_ACTIVE', 'DEVICE_QUOTA_EXCEEDED', 'LICENSE_CANONICAL_BASIS_NOT_FOUND', 'LICENSE_NOT_ACTIVE', 'LICENSE_STATE_INVALID', 'INVALID_KEY_VERSION', 'STALE_DEVICE_GENERATION'].includes(code)
    ) {
      throw new ConflictException({
        code: code.includes('already has an unresolved chain command') ? 'LICENSE_COMMAND_IN_PROGRESS' : code,
        message: 'The requested licensing transition is not allowed.',
      });
    }
    throw error;
  }
}
