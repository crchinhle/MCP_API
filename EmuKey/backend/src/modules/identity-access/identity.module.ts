import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { IdentityController } from './identity.controller.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';
import { AuthGuard, OptionalAuthGuard, RolesGuard } from './security.guards.js';
import { Reflector } from '@nestjs/core';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import {
  EMAIL_DELIVERY,
  type EmailDeliveryPort,
} from '../operations/application/ports/email-delivery.port.js';
import { OperationsModule } from '../operations/operations.module.js';
import { IdentityEmailDelivery } from './infrastructure/identity-email-delivery.js';

@Module({
  imports: [forwardRef(() => OperationsModule)],
  controllers: [IdentityController],
  providers: [
    {
      provide: IdentityRepository,
      inject: [Pool, AuditWriter],
      useFactory: (pool: Pool, audit: AuditWriter) =>
        new IdentityRepository(pool, audit),
    },
    {
      provide: IdentityService,
      inject: [IdentityRepository, Redis, ConfigService, EMAIL_DELIVERY],
      useFactory: (
        repo: IdentityRepository,
        redis: Redis,
        c: ConfigService,
        email: EmailDeliveryPort,
      ) => {
        return new IdentityService(
          repo,
          redis,
          new TextEncoder().encode(c.getOrThrow('JWT_SECRET')),
          new IdentityEmailDelivery(email),
        );
      },
    },
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    Reflector,
  ],
  exports: [AuthGuard, OptionalAuthGuard, RolesGuard, IdentityService],
})
export class IdentityModule {}
