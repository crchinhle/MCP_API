import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { AuditWriter } from '../../platform/audit/audit-writer.js';
import { ServiceTermsContent } from '../../platform/terms/service-terms-content.js';
import {
  ACTIVATION_ENVELOPE,
  type ActivationEnvelopePort,
} from '../blockchain/application/ports/activation-envelope.port.js';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { ActivationEnvelopeRecoveryService } from '../blockchain/application/activation-envelope-recovery.service.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { NotificationRepository } from '../operations/infrastructure/notification.repository.js';
import { OperationsModule } from '../operations/operations.module.js';
import { CommerceService } from './application/commerce.service.js';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from './application/ports/payment-gateway.port.js';
import {
  CommerceRepository,
  type ChainConfiguration,
} from './infrastructure/commerce.repository.js';
import { FakePaymentGateway } from './infrastructure/fake-payment.gateway.js';
import { SePayPaymentGateway } from './infrastructure/sepay-payment.gateway.js';
import {
  CommerceController,
  PaymentController,
} from './presentation/commerce.controller.js';

const CHAIN_CONFIGURATION = Symbol('CHAIN_CONFIGURATION');

@Module({
  imports: [IdentityModule, BlockchainModule, OperationsModule],
  controllers: [CommerceController, PaymentController],
  providers: [
    {
      provide: CommerceRepository,
      inject: [Pool, AuditWriter, ConfigService, NotificationRepository],
      useFactory: (
        pool: Pool,
        audit: AuditWriter,
        config: ConfigService,
        notifications: NotificationRepository,
      ) =>
        new CommerceRepository(
          pool,
          audit,
          config.getOrThrow<number>('IPN_DELIVERY_GRACE_SECONDS'),
          notifications,
        ),
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentGatewayPort => {
        const adapter = config.getOrThrow<string>('PAYMENT_ADAPTER');
        if (adapter === 'fake') {
          return new FakePaymentGateway(
            config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET'),
          );
        }
        if (adapter === 'sepay') {
          return new SePayPaymentGateway({
            environment: config.getOrThrow<'production' | 'sandbox'>('SEPAY_ENV'),
            merchantId: config.getOrThrow<string>('SEPAY_MERCHANT_ID'),
            secretKey: config.getOrThrow<string>('SEPAY_SECRET_KEY'),
            webAppUrl: config.getOrThrow<string>('WEB_APP_URL'),
            sandboxReceiptTiming: config.get<boolean>('SEPAY_SANDBOX_RECEIPT_TIMING') === true,
            ...((config.get<number>('SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS') ?? 0) > 0
              ? { sandboxClockOffsetSeconds: config.getOrThrow<number>('SEPAY_SANDBOX_CLOCK_OFFSET_SECONDS') }
              : {}),
          });
        }
        throw new Error(`Payment adapter ${adapter} is not configured`);
      },
    },
    {
      provide: CHAIN_CONFIGURATION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ChainConfiguration => ({
        chainId: config.getOrThrow<number>('EVM_CHAIN_ID'),
        contractAddress: config.getOrThrow<string>('EVM_CONTRACT_ADDRESS'),
        network: config.getOrThrow<string>('EVM_NETWORK'),
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
      useFactory: (
        repository: CommerceRepository,
        payment: PaymentGatewayPort,
        envelopes: ActivationEnvelopePort,
        recovery: ActivationEnvelopeRecoveryService,
        chain: ChainConfiguration,
         serviceTerms: ServiceTermsContent,
      ) =>
        new CommerceService(
          repository,
          payment,
          envelopes,
          recovery,
          chain,
           serviceTerms,
        ),
    },
  ],
  exports: [CommerceService],
})
export class CommerceModule {}
