import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { IdentityModule } from '../identity-access/identity.module.js';
import { OperationsModule } from '../operations/operations.module.js';
import { NotificationWriter } from '../operations/application/notification-writer.js';
import { ProviderDeliveryRepository } from './infrastructure/provider-delivery.repository.js';
import { ProviderIntegrationRepository } from './infrastructure/provider-integration.repository.js';
import { LicenseSecretCodec } from './infrastructure/license-secret-codec.js';
import { HttpProviderLicenseGateway } from './infrastructure/http-provider-license.gateway.js';
import { ProviderIntegrationService } from './application/provider-integration.service.js';
import { ProviderHandoffService } from './application/provider-handoff.service.js';
import {
  ProviderIntegrationController,
  ProviderDeliveryOperationsController,
} from './presentation/provider-integration.controller.js';

@Module({
  imports: [IdentityModule, OperationsModule],
  controllers: [
    ProviderIntegrationController,
    ProviderDeliveryOperationsController,
  ],
  providers: [
    {
      provide: ProviderDeliveryRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new ProviderDeliveryRepository(pool),
    },
    {
      provide: ProviderIntegrationRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new ProviderIntegrationRepository(pool),
    },
    {
      provide: LicenseSecretCodec,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new LicenseSecretCodec(
          config.getOrThrow<string>('ACTIVATION_ENVELOPE_KEY'),
        ),
    },
    {
      provide: HttpProviderLicenseGateway,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new HttpProviderLicenseGateway(
          config.get<string>('PROVIDER_TEST_ORIGIN'),
        ),
    },
    {
      provide: ProviderIntegrationService,
      inject: [
        ProviderIntegrationRepository,
        LicenseSecretCodec,
        HttpProviderLicenseGateway,
      ],
      useFactory: (
        repo: ProviderIntegrationRepository,
        codec: LicenseSecretCodec,
        gateway: HttpProviderLicenseGateway,
      ) => new ProviderIntegrationService(repo, codec, gateway),
    },
    {
      provide: ProviderHandoffService,
      inject: [
        ProviderDeliveryRepository,
        ProviderIntegrationRepository,
        LicenseSecretCodec,
        HttpProviderLicenseGateway,
        ProviderIntegrationService,
        NotificationWriter,
        ConfigService,
      ],
      useFactory: (
        repo: ProviderDeliveryRepository,
        integrations: ProviderIntegrationRepository,
        codec: LicenseSecretCodec,
        gateway: HttpProviderLicenseGateway,
        integration: ProviderIntegrationService,
        notifications: NotificationWriter,
        config: ConfigService,
      ) =>
        new ProviderHandoffService(
          repo,
          integrations,
          codec,
          gateway,
          integration,
          notifications,
          config.get<boolean>('PROVIDER_HANDOFF_ENABLED') !== false,
        ),
    },
  ],
  exports: [
    ProviderHandoffService,
    ProviderIntegrationService,
    ProviderDeliveryRepository,
  ],
})
export class ProviderHandoffModule {}
