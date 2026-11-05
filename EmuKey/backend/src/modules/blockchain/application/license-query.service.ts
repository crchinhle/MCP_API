import {
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Redis } from 'ioredis';

import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { LicenseProjectionRepository } from '../infrastructure/license-projection.repository.js';
import type { ActivationEnvelopePort } from './ports/activation-envelope.port.js';
import type { ActivationDeliveryRepository } from '../infrastructure/activation-delivery.repository.js';

type LicenseProjection = NonNullable<
  Awaited<ReturnType<LicenseProjectionRepository['findCustomer']>>
>;

export class LicenseQueryService {
  constructor(
    private readonly repository: LicenseProjectionRepository,
    private readonly envelopes: ActivationEnvelopePort,
    private readonly redis: Redis,
    private readonly publicVerifyRateLimit = 30,
    private readonly deliveries?: ActivationDeliveryRepository,
    private readonly handoff?: import('../../licensing/application/provider-handoff.service.js').ProviderHandoffService,
  ) {}

  async list(actor: AuthPrincipal) {
    if (actor.role === 'PROVIDER_ADMIN') return this.repository.listProvider(actor.sub);
    if (actor.role === 'CUSTOMER') {
      const licenses = await this.repository.listCustomer(actor.sub);
      return this.withActivationAvailability(actor, licenses);
    }
    throw new ForbiddenException();
  }

  async find(actor: AuthPrincipal, id: string) {
    const license =
      actor.role === 'PROVIDER_ADMIN'
        ? await this.repository.findProvider(actor.sub, id)
        : actor.role === 'CUSTOMER'
          ? await this.repository.findCustomer(actor.sub, id)
          : null;
    if (!license) this.notFound();
    if (actor.role === 'CUSTOMER') {
      const [enriched] = await this.withActivationAvailability(actor, [license]);
      return enriched ?? license;
    }
    return license;
  }

  async listDevices(actor: AuthPrincipal, id: string) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
    if (await this.handoff?.customerInfo(actor.sub, id)) {
      await this.handoff!.rejectProductUse(id);
    }
    return this.repository.listCustomerDevices(actor.sub, id);
  }

  async verify(publicId: string, requester: string) {
    if (publicId.trim().length < 20) {
      throw new BadRequestException({
        code: 'PUBLIC_LICENSE_ID_INVALID',
        message: 'Public license identifier is invalid.',
      });
    }
    const key = `public-license-verify:${requester}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 60);
    if (count > this.publicVerifyRateLimit)
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const result = await this.repository.findPublic(publicId);
    return result ?? { state: 'NOT_FOUND' };
  }

  async retrieveActivation(actor: AuthPrincipal, id: string, deliveryId: string) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
    const handoffInfo = await this.handoff?.customerInfo(actor.sub,id);
    if (handoffInfo) {
      const envelope = await this.handoff!.readCustomerKey(actor.sub,id);
      if (!this.deliveries) throw new ServiceUnavailableException();
      const receipt = await this.deliveries.claim({licenseId:id,customerId:actor.sub,commandId:envelope.commandId,keyVersion:envelope.keyVersion,deliveryId,ttlSeconds:300});
      return {activationKey:envelope.secret,keyVersion:envelope.keyVersion,deliveryId,retryUntil:receipt.retryUntil.toISOString()};
    }
    const command = await this.repository.activationCommand(actor.sub, id);
    if (!command) this.notFound();
    const envelope = await this.envelopes.read(command.command_id);
    if (
      !envelope ||
      envelope.licenseId !== command.license_id ||
      envelope.keyVersion !== Number(command.key_version) ||
      envelope.commitment !== command.commitment
    ) {
      throw new NotFoundException({
        code: 'ACTIVATION_KEY_UNAVAILABLE',
        message: 'Activation key is unavailable or was already retrieved.',
      });
    }
    if (!this.deliveries) throw new ServiceUnavailableException({ code: 'KEY_DELIVERY_NOT_CONFIGURED' });
    const ttlSeconds = await this.envelopes.remainingTtl(command.command_id);
    if (ttlSeconds < 1) throw new NotFoundException({ code: 'KEY_UNAVAILABLE' });
    const receipt = await this.deliveries.claim({ licenseId: id, customerId: actor.sub,
      commandId: command.command_id, keyVersion: envelope.keyVersion, deliveryId, ttlSeconds });
    return { activationKey: envelope.secret, keyVersion: envelope.keyVersion, deliveryId, retryUntil: receipt.retryUntil.toISOString() };
  }

  async acknowledgeActivation(actor: AuthPrincipal, id: string, deliveryId: string, keyVersion: number) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
    if (!this.deliveries) throw new ServiceUnavailableException();
    const commandId = await this.deliveries.acknowledge(actor.sub,id,keyVersion,deliveryId);
    // Receipt is durable before deletion: Redis failure cannot reopen delivery.
    if (!await this.handoff?.customerInfo(actor.sub,id)) await this.envelopes.consume(commandId).catch(() => null);
    return { acknowledged: true };
  }

  private async withActivationAvailability(
    actor: AuthPrincipal,
    licenses: LicenseProjection[],
  ): Promise<(LicenseProjection & { activationKeyAvailable: boolean })[]> {
    return Promise.all(
      licenses.map(async (license) => {
        const provider = await this.handoff?.customerInfo(actor.sub,String(license.id));
        if (provider) {
          const available = provider.keyAvailable && (!this.deliveries || await this.deliveries.available(String(license.id),provider.keyVersion,actor.sub));
          return {...license,...provider,keyAvailable:available,activationKeyAvailable:available};
        }
        const command = await this.repository.activationCommand(actor.sub, String(license.id));
        return {
          ...license,
          activationKeyAvailable: command ? await this.envelopes.exists(command.command_id) &&
            (!this.deliveries || await this.deliveries.available(String(license.id), Number(command.key_version), actor.sub)) : false,
        };
      }),
    );
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'LICENSE_NOT_FOUND',
      message: 'License was not found.',
    });
  }

}
