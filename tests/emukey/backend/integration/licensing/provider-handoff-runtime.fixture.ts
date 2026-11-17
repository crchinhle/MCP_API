import { Pool } from 'pg';
import { ProviderDeliveryRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/provider-delivery.repository.js';
import { LicenseSecretCodec } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/license-secret-codec.js';
import { ProviderIntegrationRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/provider-integration.repository.js';
import { ProviderIntegrationService } from '../../../../../EmuKey/backend/src/modules/licensing/application/provider-integration.service.js';
import { ProviderHandoffService } from '../../../../../EmuKey/backend/src/modules/licensing/application/provider-handoff.service.js';
import { HttpProviderLicenseGateway } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/http-provider-license.gateway.js';
import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';

export const fixtureProvider = '00000000-0000-4000-8000-000000000002';
export const fixtureCustomer = '00000000-0000-4000-8000-000000000004';

export function handoffRuntime(pool: Pool, origin: string) {
  const codec = new LicenseSecretCodec('a'.repeat(64));
  const gateway = new HttpProviderLicenseGateway(origin);
  const configs = new ProviderIntegrationRepository(pool);
  const integration = new ProviderIntegrationService(configs, codec, gateway);
  const repo = new ProviderDeliveryRepository(pool);
  const handoff = new ProviderHandoffService(repo, configs, codec, gateway, integration, new NotificationRepository(pool));
  return { codec, gateway, configs, integration, repo, handoff };
}

