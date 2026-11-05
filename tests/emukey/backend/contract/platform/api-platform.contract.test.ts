import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';

import {
  AI_GATEWAY,
  type AiGatewayPort,
} from '../../../../../EmuKey/backend/src/modules/assistance-support/application/ports/ai-gateway.port.js';
import {
  EMAIL_DELIVERY,
  type EmailDeliveryPort,
} from '../../../../../EmuKey/backend/src/modules/operations/application/ports/email-delivery.port.js';
import {
  PUSH_DELIVERY,
  type PushDeliveryPort,
} from '../../../../../EmuKey/backend/src/modules/operations/application/ports/push-delivery.port.js';

const testEnvironment = {
  NODE_ENV: 'test',
  PORT: '3100',
  DATABASE_URL: 'postgresql://emukey:password@127.0.0.1:1/emukey',
  REDIS_URL: 'redis://127.0.0.1:1',
  CORS_ORIGINS: 'http://localhost:5173',
  LOG_LEVEL: 'fatal',
  OTEL_ENABLED: 'false',
  PAYMENT_ADAPTER: 'fake',
  SEPAY_SANDBOX_RECEIPT_TIMING: 'false',
  PAYMENT_WEBHOOK_SECRET: 'test-payment-secret',
  AI_ADAPTER: 'fake',
  EMAIL_ADAPTER: 'fake',
  PUSH_ADAPTER: 'fake',
  EVM_ADAPTER: 'viem',
  EVM_NETWORK: 'sepolia',
  EVM_CHAIN_ID: '11155111',
  EVM_CONFIRMATIONS: '2',
  EVM_CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  EVM_DEPLOYMENT_BLOCK: '1',
  EVM_INDEXER_BATCH_SIZE: '500',
  EVM_RPC_HTTP_URL: 'http://127.0.0.1:1',
  EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
  STORAGE_ADAPTER: 'local',
  ACTIVATION_ENVELOPE_ADAPTER: 'redis',
  ACTIVATION_ENVELOPE_KEY: '00'.repeat(32),
};

describe('API platform contract', () => {
  it('keeps reviewed module boundaries behind published application interfaces', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    for (const path of [
      'licensing/licensing.service.ts', 'licensing/licensing.module.ts',
      'commerce-payment/commerce.module.ts', 'commerce-payment/infrastructure/commerce.repository.ts',
      'assistance-support/assistance-support.module.ts', 'assistance-support/infrastructure/assistance-support.repository.ts',
    ]) {
      const source = await readFile(resolve('src/modules', path), 'utf8');
      expect(source, path).not.toMatch(/from ['"](?:\.\.\/)+(?:blockchain|operations)\/infrastructure\//);
    }
  });
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, testEnvironment);
    const { createApiApplication } =
      await import('../../../../../EmuKey/backend/src/entrypoints/api/create-api-application.js');
    app = await createApiApplication({ logger: false });
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness under the versioned API prefix', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok', service: 'emukey-api' });
  });

  it('aligns runtime POST statuses with the documented success responses of every controller', async () => {
    const document = (await request(app.getHttpServer() as Server).get('/api/v1/openapi.json').expect(200)).body as OpenAPIObject;
    const operations = Object.values(document.paths).flatMap((path) => path?.post ? [path.post] : []);
    const mismatches: string[] = [];
    for (const module of app.get(ModulesContainer).values()) {
      for (const controller of module.controllers.values()) {
        const prototype = controller.metatype?.prototype;
        if (!prototype) continue;
        for (const name of Object.getOwnPropertyNames(prototype)) {
          const handler = prototype[name];
          if (typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.POST) continue;
          const operation = operations.find((item) => item.operationId === `${controller.metatype!.name}_${name}`);
          const success = Object.keys(operation?.responses ?? {}).filter((code) => /^2\d\d$/.test(code));
          const runtime = String(Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? 201);
          if (success.length && !success.includes(runtime)) mismatches.push(`${controller.name}.${name}: runtime ${runtime}, documented ${success.join('/')}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('uses the canonical structured error envelope', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/not-a-route')
      .set('x-request-id', 'contract-test-request')
      .expect(404);

    expect(response.body as unknown).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Not Found',
        traceId: 'contract-test-request',
      },
    });
  });

  it('exposes the generated OpenAPI document at a stable route', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);

    const document = response.body as OpenAPIObject;
    expect(document.info).toMatchObject({
      title: 'Emukey API',
      version: '1.0.0',
    });
    expect(document.paths).toHaveProperty('/api/v1/health/live');
    expect(document.components?.schemas).toHaveProperty('ApiErrorEnvelopeDto');
  });

  it('returns the documented HTTP 200 for public entitlement verification', async () => {
    const { LicensingService } = await import('../../../../../EmuKey/backend/src/modules/licensing/licensing.service.js');
    const result = { valid: true as const, bindingGeneration: 1, entitlementVersion: 1, keyVersion: 1,
      licenseId: '00000000-0000-4000-8000-000000000401', deviceId: '00000000-0000-4000-8000-000000000901',
      rights: { desktop: true }, expiresAt: '2030-01-01T00:00:00.000Z' };
    const verify = vi.spyOn(app.get(LicensingService), 'verifyEntitlement').mockResolvedValueOnce(result);
    try {
      const response = await request(app.getHttpServer() as Server).post('/api/v1/entitlements/verify').send({ token: 'test-entitlement-token-32-characters' }).expect(200);
      expect(response.body).toEqual(result);
    } finally { verify.mockRestore(); }
  });

  it('publishes typed catalog response contracts for generated clients', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    expect(document.components?.schemas).toHaveProperty('AdminProductDto');
    expect(document.components?.schemas).toHaveProperty('AdminPlanDto');
    expect(document.components?.schemas).toHaveProperty(
      'PublicCatalogProductDto',
    );
    expect(document.components?.schemas).toHaveProperty(
      'ComparePlansResponseDto',
    );
  });

  it('publishes typed Phase 4 commerce and payment contracts', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    for (const schema of [
      'OrderDto',
      'OrderTermsDto',
      'CheckoutSessionDto',
      'PaymentIngestResultDto',
      'PaymentHistoryDto',
      'PaymentReceiptDto',
      'PaymentReviewDto',
    ]) {
      expect(document.components?.schemas).toHaveProperty(schema);
    }
    expect(document.paths).toHaveProperty('/api/v1/orders/{id}/service-terms');
    expect(document.paths).toHaveProperty('/api/v1/payments/history');
    expect(document.paths).toHaveProperty('/api/v1/payments/{id}/receipt');
  });

  it('publishes allowlisted Phase 5 License contracts for generated clients', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/openapi.json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    for (const schema of [
      'LicenseProjectionDto',
      'ActivationKeyDto',
      'PublicLicenseVerificationDto',
    ]) {
      expect(document.components?.schemas).toHaveProperty(schema);
    }
    expect(document.paths).toHaveProperty('/api/v1/licenses');
    expect(document.paths).toHaveProperty(
      '/api/v1/licenses/{id}/activation-key/retrieve',
    );
    expect(document.paths).toHaveProperty(
      '/api/v1/public/licenses/{publicId}/verify',
    );

    const publicSchema = document.components?.schemas?.[
      'PublicLicenseVerificationDto'
    ] as { properties?: Record<string, unknown> };
    expect(Object.keys(publicSchema.properties ?? {}).sort()).toEqual([
      'blockNumber',
      'confirmationCount',
      'expiresAt',
      'finality',
      'fulfillmentMode',
      'licenseId',
      'plan',
      'productName',
      'provider',
      'providerDeliveryStatus',
      'state',
      'status',
      'transactionHash',
    ]);
  });

  it('wires the configured AI and notification adapters through their ports', async () => {
    const ai = app.get<AiGatewayPort>(AI_GATEWAY);
    const email = app.get<EmailDeliveryPort>(EMAIL_DELIVERY);
    const push = app.get<PushDeliveryPort>(PUSH_DELIVERY);

    await expect(
      ai.answerGrounded({ question: 'No source', sources: [] }),
    ).resolves.toMatchObject({ grounded: false });
    await expect(
      email.deliver({
        data: {},
        eventKey: 'phase2-email',
        template: 'phase2',
        to: 'customer@example.test',
      }),
    ).resolves.toEqual({ providerMessageId: 'fake-email-phase2-email' });
    await expect(
      push.deliver({
        body: 'Phase 2',
        data: {},
        eventKey: 'phase2-push',
        title: 'Phase 2',
        token: 'test-device-token',
      }),
    ).resolves.toEqual({ providerMessageId: 'fake-push-phase2-push' });
  });
});
