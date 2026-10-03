var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException, } from '@nestjs/common';
import { keccak256, stringToHex } from 'viem';
import { activationCommitment, canonicalizeEntitlements, } from '../../../platform/crypto/license-crypto.js';
import { ServiceTermsContent } from '../../../platform/terms/service-terms-content.js';
import { renewalExpiry } from '../domain/renewal-policy.js';
import { CommerceRepository, } from '../infrastructure/commerce.repository.js';
const ACTIVATION_ENVELOPE_TTL = 86_400;
let CommerceService = class CommerceService {
    repository;
    payment;
    envelopes;
    envelopeRecovery;
    chain;
    serviceTerms;
    constructor(repository, payment, envelopes, envelopeRecovery, chain, serviceTerms = new ServiceTermsContent()) {
        this.repository = repository;
        this.payment = payment;
        this.envelopes = envelopes;
        this.envelopeRecovery = envelopeRecovery;
        this.chain = chain;
        this.serviceTerms = serviceTerms;
    }
    async createOrder(actor, idempotencyKey, _licenseKey, dto) {
        this.requireCustomer(actor);
        if (!idempotencyKey ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
            throw new BadRequestException({
                code: 'INVALID_IDEMPOTENCY_KEY',
                message: 'Idempotency-Key must be a UUID.',
            });
        }
        try {
            return await this.repository.createOrder(actor.sub, idempotencyKey, dto.planId, dto.targetLicenseId, await this.serviceTerms.loadServiceTermsArtifact());
        }
        catch (error) {
            this.translate(error);
            throw error;
        }
    }
    async listOrders(actor) {
        this.requireCustomer(actor);
        await this.repository.cancelOverdueOrders(actor.sub);
        return this.repository.listCustomerOrders(actor.sub);
    }
    async renewalPreview(actor, licenseId) {
        this.requireCustomer(actor);
        const offer = await this.repository.findRenewalOffer(actor.sub, licenseId);
        if (!offer)
            this.notFound();
        const pendingOrder = await this.repository.findPendingRenewal(actor.sub, licenseId);
        const canRenew = ['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(offer.status)
            && offer.planPublished && offer.productPublished;
        const months = pendingOrder?.durationMonthsSnapshot ?? offer.durationMonths;
        return {
            licenseId, planId: offer.planId, planName: pendingOrder?.planNameSnapshot ?? offer.planName,
            productName: offer.productName, currentExpiresAt: offer.expiresAt,
            durationMonths: months, priceVnd: pendingOrder?.priceVndSnapshot ?? offer.priceVnd,
            estimatedExpiresAt: pendingOrder?.renewalExpiresAt ?? renewalExpiry(offer.expiresAt, new Date(), months),
            canRenew, pendingOrder: pendingOrder ?? null,
        };
    }
    async findOrder(actor, id) {
        this.requireCustomer(actor);
        await this.repository.cancelOverdueOrders(actor.sub);
        const order = await this.repository.findOrder(actor.sub, id);
        if (!order)
            this.notFound();
        return order;
    }
    cancelOverdueOrders() {
        return this.repository.cancelOverdueOrders();
    }
    async getServiceTerms(actor, id) {
        this.requireCustomer(actor);
        const order = await this.repository.findOrder(actor.sub, id);
        if (!order)
            this.notFound();
        // Serve the immutable snapshot taken when the Order was created, never the
        // currently published platform document, so acceptance stays well-defined.
        if (order.serviceTermsContentSnapshot === null ||
            order.serviceTermsHashSnapshot === null ||
            order.serviceTermsVersionSnapshot === null) {
            throw new ConflictException({
                code: 'ORDER_TERMS_SNAPSHOT_MISSING',
                message: 'The Service Terms snapshot for this order is unavailable.',
            });
        }
        return {
            content: order.serviceTermsContentSnapshot,
            hash: order.serviceTermsHashSnapshot,
            version: order.serviceTermsVersionSnapshot,
        };
    }
    async acceptServiceTerms(actor, id, dto) {
        this.requireCustomer(actor);
        if (dto.accepted !== true)
            throw new BadRequestException('Service Terms must be accepted explicitly.');
        try {
            // Compare against the Order's own snapshot rather than the newest platform
            // content, so a concurrent content update cannot silently re-consent a buyer.
            return await this.repository.acceptServiceTerms(actor.sub, id, dto);
        }
        catch (error) {
            this.translate(error);
            throw error;
        }
    }
    async cancelOrder(actor, id) {
        this.requireCustomer(actor);
        try {
            return await this.repository.cancelOrder(actor.sub, id);
        }
        catch (error) {
            this.translate(error);
            throw error;
        }
    }
    async checkout(actor, id) {
        this.requireCustomer(actor);
        const order = await this.repository.findOrder(actor.sub, id);
        if (!order)
            this.notFound();
        let preparation;
        try {
            preparation = await this.repository.prepareCheckout(actor.sub, id);
        }
        catch (error) {
            this.translate(error);
            throw error;
        }
        try {
            const checkout = await this.payment.createCheckout({
                amountVnd: preparation.amountVnd,
                attemptId: preparation.attemptId,
                checkoutReference: preparation.checkoutReference,
                orderId: preparation.orderId,
            });
            if (checkout.checkoutReference !== preparation.checkoutReference) {
                throw new Error('PAYMENT_CHECKOUT_REFERENCE_MISMATCH');
            }
            return {
                ...checkout,
                amountVnd: preparation.amountVnd,
                attemptId: preparation.attemptId,
                expiresAt: preparation.expiresAt.toISOString(),
                expiresWithOrder: true,
            };
        }
        catch (error) {
            if (!preparation.existing) {
                await this.repository.failCheckout(preparation.attemptId);
            }
            throw error;
        }
    }
    async ingestIpn(payload, signature) {
        let event;
        try {
            event = await this.payment.verifyIpn({
                payload,
                ...(signature === undefined ? {} : { signature }),
            });
        }
        catch (error) {
            if (error instanceof Error &&
                error.message === 'INVALID_PAYMENT_SIGNATURE') {
                throw new UnauthorizedException({
                    code: 'INVALID_PAYMENT_SIGNATURE',
                    message: 'Payment signature is invalid.',
                });
            }
            throw new BadRequestException({
                code: 'INVALID_PAYMENT_PAYLOAD',
                message: 'Payment payload is invalid.',
            });
        }
        return this.fulfillPayment(event, payload);
    }
    // Operator-only recovery of already-authenticated, durable sandbox evidence.
    // This is deliberately not exposed through the unauthenticated IPN endpoint.
    async reconcileSandboxPayment(actor, id, reason) {
        if (actor.role !== 'SYSTEM_ADMIN')
            this.forbidden();
        if (this.payment.sandboxReceiptTiming !== true) {
            throw new ConflictException('SANDBOX_RECEIPT_TIMING_NOT_ENABLED');
        }
        if (!reason.trim() || reason.length > 1000)
            throw new BadRequestException('A reconciliation reason is required.');
        const evidence = await this.repository.findSandboxPaymentEvidence(id);
        if (!evidence)
            throw new NotFoundException('SANDBOX_PAYMENT_EVIDENCE_NOT_FOUND');
        return this.fulfillPayment({ ...evidence.event, timingBasis: 'SANDBOX_RECEIPT' }, evidence.payload, { transactionId: id, actor, reason: reason.trim() });
    }
    async fulfillPayment(event, payload, reconciliation) {
        const activation = this.newActivation(1);
        const result = await this.repository.ingestPayment(event, payload, activation.material, this.chain, reconciliation);
        if (result.classification === 'MATCHED' &&
            result.activationRequired &&
            result.commandId &&
            result.licenseId) {
            try {
                await this.envelopes.prepare({
                    commandId: result.commandId,
                    commitment: activation.material.activationCommitment,
                    keyVersion: 1,
                    licenseId: result.licenseId,
                    secret: activation.secret,
                }, ACTIVATION_ENVELOPE_TTL);
            }
            catch {
                await this.envelopeRecovery.recoverById(result.commandId, result.licenseId);
            }
        }
        return result;
    }
    listPaymentHistory(actor) {
        this.requirePaymentEvidenceRole(actor);
        return this.repository.listPaymentHistory(actor);
    }
    async getPaymentReceipt(actor, id) {
        this.requirePaymentEvidenceRole(actor);
        const receipt = await this.repository.getPaymentReceipt(actor, id);
        if (!receipt) {
            throw new NotFoundException({
                code: 'PAYMENT_RECEIPT_NOT_FOUND',
                message: 'Payment receipt was not found.',
            });
        }
        return receipt;
    }
    async listPaymentReview(actor) {
        this.requireReviewRole(actor);
        // Resolved/closed outcomes are evidence too; they stay visible so the queue
        // does not keep showing already-decided anomalies as open work.
        return this.repository.listPaymentReview(true);
    }
    async reviewPayment(actor, id, status, reason) {
        this.requireReviewRole(actor);
        try {
            return await this.repository.reviewPayment(actor, id, status, reason);
        }
        catch (error) {
            this.translate(error);
            throw error;
        }
    }
    newActivation(keyVersion, commandId = randomUUID(), licenseId = randomUUID()) {
        const secret = `0x${randomBytes(32).toString('hex')}`;
        const commitment = activationCommitment(secret);
        const payload = {
            activationCommitment: commitment,
            commandId,
            keyVersion,
            licenseId,
            protocolVersion: 1,
        };
        const payloadHash = keccak256(stringToHex(canonicalizeEntitlements(payload)));
        return {
            material: {
                activationCommitment: commitment,
                commandId,
                licenseId,
                payload,
                payloadHash,
            },
            secret,
        };
    }
    notFound() {
        throw new NotFoundException({
            code: 'ORDER_NOT_FOUND',
            message: 'Order was not found.',
        });
    }
    requirePaymentEvidenceRole(actor) {
        if (!['CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(actor.role)) {
            this.forbidden();
        }
    }
    requireReviewRole(actor) {
        if (!['SYSTEM_ADMIN', 'SUPPORT_STAFF'].includes(actor.role)) {
            this.forbidden();
        }
    }
    requireCustomer(actor) {
        if (actor.role !== 'CUSTOMER')
            this.forbidden();
    }
    forbidden() {
        throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: 'Payment evidence access is not allowed for this role.',
        });
    }
    translate(error) {
        const code = error instanceof Error ? error.message : '';
        if (code === 'PLAN_NOT_FOUND' ||
            code === 'RENEWAL_LICENSE_NOT_FOUND' ||
            code === 'ORDER_NOT_FOUND' ||
            code === 'PAYMENT_REVIEW_NOT_FOUND') {
            this.notFound();
        }
        if (code === 'IDEMPOTENCY_CONFLICT') {
            throw new ConflictException({
                code,
                message: 'Idempotency key was already used with another request.',
            });
        }
        if (code === 'ORDER_TERMS_MISMATCH' ||
            code === 'ORDER_TERMS_SNAPSHOT_CHANGED' ||
            code === 'ORDER_NOT_CANCELLABLE' ||
            code === 'ORDER_NOT_WAITING_PAYMENT' ||
            code === 'ORDER_PAYMENT_EXPIRED') {
            throw new ConflictException({
                code,
                message: 'Order state does not allow this operation.',
            });
        }
    }
};
CommerceService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [CommerceRepository, Object, Object, Function, Object, Object])
], CommerceService);
export { CommerceService };
//# sourceMappingURL=commerce.service.js.map