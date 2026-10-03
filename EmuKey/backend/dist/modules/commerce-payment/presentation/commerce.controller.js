var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards, } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { CommerceService } from '../application/commerce.service.js';
import { AcceptServiceTermsDto, CheckoutSessionDto, CreateOrderDto, OrderDto, OrderTermsDto, PaymentHistoryDto, PaymentIngestResultDto, PaymentReceiptDto, PaymentReviewDto, ReviewPaymentDto, RenewalPreviewDto, } from './commerce.dto.js';
let CommerceController = class CommerceController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(actor, idempotencyKey, dto) {
        return this.service.createOrder(actor, idempotencyKey, undefined, dto);
    }
    list(actor) {
        return this.service.listOrders(actor);
    }
    renewalPreview(actor, licenseId) {
        return this.service.renewalPreview(actor, licenseId);
    }
    find(actor, id) {
        return this.service.findOrder(actor, id);
    }
    serviceTerms(actor, id) {
        return this.service.getServiceTerms(actor, id);
    }
    acceptServiceTerms(actor, id, dto) {
        return this.service.acceptServiceTerms(actor, id, dto);
    }
    checkout(actor, id) {
        return this.service.checkout(actor, id);
    }
    cancel(actor, id) {
        return this.service.cancelOrder(actor, id);
    }
};
__decorate([
    Post(),
    ApiHeader({ name: 'Idempotency-Key', required: true }),
    ApiOperation({ summary: 'Create a purchase or resume an account-owned renewal. No license secret required.' }),
    ApiCreatedResponse({ type: OrderDto }),
    __param(0, CurrentUser()),
    __param(1, Headers('idempotency-key')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, CreateOrderDto]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "create", null);
__decorate([
    Get(),
    ApiOkResponse({ type: OrderDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "list", null);
__decorate([
    Get('renewal-preview/:licenseId'),
    ApiOkResponse({ type: RenewalPreviewDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('licenseId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "renewalPreview", null);
__decorate([
    Get(':id'),
    ApiOkResponse({ type: OrderDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "find", null);
__decorate([
    Get(':id/service-terms'),
    ApiOperation({ summary: 'Get the platform Service Terms content' }),
    ApiOkResponse({ type: OrderTermsDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "serviceTerms", null);
__decorate([
    Post(':id/accept-service-terms'),
    HttpCode(HttpStatus.OK),
    ApiOkResponse({ type: OrderDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AcceptServiceTermsDto]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "acceptServiceTerms", null);
__decorate([
    Post(':id/checkout'),
    HttpCode(HttpStatus.OK),
    ApiOkResponse({ type: CheckoutSessionDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "checkout", null);
__decorate([
    Post(':id/cancel'),
    HttpCode(HttpStatus.OK),
    ApiOkResponse({ type: OrderDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CommerceController.prototype, "cancel", null);
CommerceController = __decorate([
    ApiTags('commerce'),
    Controller('orders'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [CommerceService])
], CommerceController);
export { CommerceController };
let PaymentController = class PaymentController {
    service;
    constructor(service) {
        this.service = service;
    }
    ingest(payload, signature) {
        return this.service.ingestIpn(payload, signature);
    }
    history(actor) {
        return this.service.listPaymentHistory(actor);
    }
    reviewQueue(actor) {
        return this.service.listPaymentReview(actor);
    }
    review(actor, id, dto) {
        return this.service.reviewPayment(actor, id, dto.status, dto.reason);
    }
    getReceipt(actor, id) {
        return this.service.getPaymentReceipt(actor, id);
    }
};
__decorate([
    Post('ipn'),
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Ingest an idempotent payment provider event' }),
    ApiOkResponse({ type: PaymentIngestResultDto }),
    __param(0, Body()),
    __param(1, Headers('x-secret-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "ingest", null);
__decorate([
    Get('history'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'List role-scoped durable payment evidence' }),
    ApiOkResponse({ type: PaymentHistoryDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "history", null);
__decorate([
    Get('review'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    ApiOkResponse({ type: PaymentReviewDto, isArray: true }),
    ApiForbiddenResponse(),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "reviewQueue", null);
__decorate([
    Post('review/:id'),
    HttpCode(HttpStatus.OK),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    ApiOkResponse({ type: PaymentReviewDto }),
    ApiNotFoundResponse(),
    ApiForbiddenResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ReviewPaymentDto]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "review", null);
__decorate([
    Get(':id/receipt'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a receipt derived from durable matched payment evidence' }),
    ApiOkResponse({ type: PaymentReceiptDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "getReceipt", null);
PaymentController = __decorate([
    ApiTags('payments'),
    Controller('payments'),
    __metadata("design:paramtypes", [CommerceService])
], PaymentController);
export { PaymentController };
//# sourceMappingURL=commerce.controller.js.map