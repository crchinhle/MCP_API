var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import { ServiceTermsContent } from '../../platform/terms/service-terms-content.js';
import { ACTIVATION_ENVELOPE, } from '../blockchain/application/ports/activation-envelope.port.js';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { ActivationEnvelopeRecoveryService } from '../blockchain/application/activation-envelope-recovery.service.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { NotificationRepository } from '../operations/infrastructure/notification.repository.js';
import { OperationsModule } from '../operations/operations.module.js';
import { CommerceService } from './application/commerce.service.js';
import { PAYMENT_GATEWAY, } from './application/ports/payment-gateway.port.js';
import { CommerceRepository, } from './infrastructure/commerce.repository.js';
import { FakePaymentGateway } from './infrastructure/fake-payment.gateway.js';
import { SePayPaymentGateway } from './infrastructure/sepay-payment.gateway.js';
import { CommerceController, PaymentController, } from './presentation/commerce.controller.js';
const CHAIN_CONFIGURATION = Symbol('CHAIN_CONFIGURATION');
let CommerceModule = class CommerceModule {
};
CommerceModule = __decorate([
    Module({
        imports: [IdentityModule, BlockchainModule, OperationsModule],
        controllers: [CommerceController, PaymentController],
        providers: [
            {
                provide: CommerceRepository,
                inject: [Pool, AuditWriter, ConfigService, NotificationRepository],
                useFactory: (pool, audit, config, notifications) => new CommerceRepository(pool, audit, config.getOrThrow('IPN_DELIVERY_GRACE_SECONDS'), notifications),
            },
            {
                provide: PAYMENT_GATEWAY,
                inject: [ConfigService],
                useFactory: (config) => {
                    const adapter = config.getOrThrow('PAYMENT_ADAPTER');
                    if (adapter === 'fake') {
                        return new FakePaymentGateway(config.getOrThrow('PAYMENT_WEBHOOK_SECRET'));
                    }
                    if (adapter === 'sepay') {
                        return new SePayPaymentGateway({
                            environment: config.getOrThrow('SEPAY_ENV'),
                            merchantId: config.getOrThrow('SEPAY_MERCHANT_ID'),
                            secretKey: config.getOrThrow('SEPAY_SECRET_KEY'),
                            webAppUrl: config.getOrThrow('WEB_APP_URL'),
                            sandboxReceiptTiming: config.get('SEPAY_SANDBOX_RECEIPT_TIMING') === true,
                            ...((config.get('SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS') ?? 0) > 0
                                ? { sandboxClockOffsetSeconds: config.getOrThrow('SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS') }
                                : {}),
                        });
                    }
                    throw new Error(`Payment adapter ${adapter} is not configured`);
                },
            },
            {
                provide: CHAIN_CONFIGURATION,
                inject: [ConfigService],
                useFactory: (config) => ({
                    chainId: config.getOrThrow('EVM_CHAIN_ID'),
                    contractAddress: config.getOrThrow('EVM_CONTRACT_ADDRESS'),
                    network: config.getOrThrow('EVM_NETWORK'),
                }),
            },
            {
                provide: CommerceService,
                inject: [
                    CommerceRepository,
                    PAYMENT_GATEWAY,
                    ACTIVATION_ENVELOPE,
                    ActivationEnvelopeRecoveryService,
                    CHAIN_CONFIGURATION,
                    ServiceTermsContent,
                ],
                useFactory: (repository, payment, envelopes, recovery, chain, serviceTerms) => new CommerceService(repository, payment, envelopes, recovery, chain, serviceTerms),
            },
        ],
        exports: [CommerceService],
    })
], CommerceModule);
export { CommerceModule };
//# sourceMappingURL=commerce.module.js.map