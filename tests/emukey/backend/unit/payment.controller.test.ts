import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { CommerceService } from '../../../../EmuKey/backend/src/modules/commerce-payment/application/commerce.service.js';
import { PaymentController } from '../../../../EmuKey/backend/src/modules/commerce-payment/presentation/commerce.controller.js';
import { AuthGuard, RolesGuard } from '../../../../EmuKey/backend/src/modules/identity-access/security.guards.js';
import type { CommerceRepository, OrderRecord } from '../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.js';
import type { PaymentGatewayPort } from '../../../../EmuKey/backend/src/modules/commerce-payment/application/ports/payment-gateway.port.js';
import type { ActivationEnvelopePort } from '../../../../EmuKey/backend/src/modules/blockchain/application/ports/activation-envelope.port.js';
import type { ActivationEnvelopeRecoveryService } from '../../../../EmuKey/backend/src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { ServiceTermsContent } from '../../../../EmuKey/backend/src/platform/terms/service-terms-content.js';

const customer = { role: 'CUSTOMER' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000004' };
const admin = { role: 'SYSTEM_ADMIN' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000001' };
const orderId = '00000000-0000-4000-8000-000000000901';

function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    billingCycleSnapshot: 'MONTHLY', createdAt: new Date(), currency: 'VND',
    customerUserId: customer.sub, durationMonthsSnapshot: 1, entitlementsSnapshot: {},
    id: orderId, licenseId: null, maxActiveDevicesSnapshot: 1, orderNumber: 'ORD-1',
    orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE', orderType: 'NEW_PURCHASE',
    paymentDueAt: new Date(), planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
    planId: '00000000-0000-4000-8000-000000000301', planNameSnapshot: 'Pro',
    planVersionSnapshot: 1, priceVndSnapshot: 100_000, productId: '00000000-0000-4000-8000-000000000201',
    productNameSnapshot: 'EmuKey', providerNameSnapshot: 'Provider', providerUserId: '00000000-0000-4000-8000-000000000002',
    publicLicenseId: null, targetLicenseId: null, serviceTermsAcceptedAt: null,
    serviceTermsContentSnapshot: null, serviceTermsHashSnapshot: null, serviceTermsVersionSnapshot: null,
    ...overrides,
  };
}

function service(repository: Partial<CommerceRepository>) {
  return new CommerceService(
    repository as never,
    {} as PaymentGatewayPort,
    {} as ActivationEnvelopePort,
    {} as ActivationEnvelopeRecoveryService,
    { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
    new ServiceTermsContent(),
  );
}

describe('CommerceService service terms snapshot', () => {
  it('serves the order snapshot instead of the currently published document', async () => {
    const findOrder = vi.fn().mockResolvedValue(order({
      serviceTermsContentSnapshot: 'terms shown at checkout',
      serviceTermsHashSnapshot: 'a'.repeat(64),
      serviceTermsVersionSnapshot: 'v1',
    }));

    await expect(service({ findOrder }).getServiceTerms(customer, orderId)).resolves.toEqual({
      content: 'terms shown at checkout',
      hash: 'a'.repeat(64),
      version: 'v1',
    });
  });

  it('refuses to serve terms for a legacy order that never recorded a snapshot', async () => {
    const findOrder = vi.fn().mockResolvedValue(order());

    await expect(service({ findOrder }).getServiceTerms(customer, orderId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects accepting a snapshot the order was not created with', async () => {
    const acceptServiceTerms = vi.fn().mockRejectedValue(new Error('ORDER_TERMS_SNAPSHOT_CHANGED'));
    const findOrder = vi.fn().mockResolvedValue(order({
      serviceTermsContentSnapshot: 'a', serviceTermsHashSnapshot: 'a'.repeat(64), serviceTermsVersionSnapshot: 'v1',
    }));
    const target = service({ acceptServiceTerms, findOrder });

    await expect(
      target.acceptServiceTerms(customer, orderId, { accepted: true, hash: 'b'.repeat(64), version: 'v1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not expose another account order terms', async () => {
    const findOrder = vi.fn().mockResolvedValue(null);

    await expect(
      service({ findOrder }).getServiceTerms(
        { ...customer, sub: '00000000-0000-4000-8000-000000000099' }, orderId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CommerceService payment review visibility', () => {
  it('keeps the reconciliation queue limited to reviewers', async () => {
    const listPaymentReview = vi.fn().mockResolvedValue([]);
    const target = service({ listPaymentReview });

    await expect(target.listPaymentReview(admin)).resolves.toEqual([]);
    expect(listPaymentReview).toHaveBeenCalledWith(true);
    await expect(target.listPaymentReview(customer)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('PaymentController', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('passes the official SePay X-Secret-Key header to IPN verification', async () => {
    const ingestIpn = vi.fn().mockResolvedValue({
      classification: 'DUPLICATE',
      transactionId: '286c64be-fdcf-4940-8e78-f1a01482d613',
    });
    const module = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: CommerceService, useValue: { ingestIpn } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();

    const payload = { notification_type: 'ORDER_PAID' };
    await request(app.getHttpServer() as Server)
      .post('/payments/ipn')
      .set('X-Secret-Key', 'sandbox-ipn-secret')
      .send(payload)
      .expect(200);

    expect(ingestIpn).toHaveBeenCalledWith(payload, 'sandbox-ipn-secret');
  });
});
