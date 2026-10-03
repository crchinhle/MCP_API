var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
import { EMAIL_DELIVERY, } from '../operations/application/ports/email-delivery.port.js';
import { OperationsModule } from '../operations/operations.module.js';
import { IdentityEmailDelivery } from './infrastructure/identity-email-delivery.js';
let IdentityModule = class IdentityModule {
};
IdentityModule = __decorate([
    Module({
        imports: [forwardRef(() => OperationsModule)],
        controllers: [IdentityController],
        providers: [
            {
                provide: IdentityRepository,
                inject: [Pool, AuditWriter],
                useFactory: (pool, audit) => new IdentityRepository(pool, audit),
            },
            {
                provide: IdentityService,
                inject: [IdentityRepository, Redis, ConfigService, EMAIL_DELIVERY],
                useFactory: (repo, redis, c, email) => {
                    return new IdentityService(repo, redis, new TextEncoder().encode(c.getOrThrow('JWT_SECRET')), new IdentityEmailDelivery(email));
                },
            },
            AuthGuard,
            OptionalAuthGuard,
            RolesGuard,
            Reflector,
        ],
        exports: [AuthGuard, OptionalAuthGuard, RolesGuard, IdentityService],
    })
], IdentityModule);
export { IdentityModule };
//# sourceMappingURL=identity.module.js.map