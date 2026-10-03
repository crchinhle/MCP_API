import {
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { Redis } from 'ioredis';

import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { LicenseProjectionRepository } from '../infrastructure/license-projection.repository.js';
import type { ActivationEnvelopePort } from './ports/activation-envelope.port.js';

type LicenseProjection = NonNullable<
  Awaited<ReturnType<LicenseProjectionRepository['findCustomer']>>
>;

export class LicenseQueryService {
  constructor(
    private readonly repository: LicenseProjectionRepository,
    private readonly envelopes: ActivationEnvelopePort,
    private readonly redis: Redis,
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
    if (count > 30)
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const result = await this.repository.findPublic(publicId);
    return result ?? { state: 'NOT_FOUND' };
  }

  async retrieveActivation(actor: AuthPrincipal, id: string) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
    const command = await this.repository.activationCommand(actor.sub, id);
    if (!command) this.notFound();
    const envelope = await this.envelopes.consume(command.command_id);
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
    return { activationKey: envelope.secret, keyVersion: envelope.keyVersion };
  }

  private async withActivationAvailability(
    actor: AuthPrincipal,
    licenses: LicenseProjection[],
  ): Promise<(LicenseProjection & { activationKeyAvailable: boolean })[]> {
    return Promise.all(
      licenses.map(async (license) => {
        const command = await this.repository.activationCommand(actor.sub, String(license.id));
        return {
          ...license,
          activationKeyAvailable: command ? await this.envelopes.exists(command.command_id) : false,
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
