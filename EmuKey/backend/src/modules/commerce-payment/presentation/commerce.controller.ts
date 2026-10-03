import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { CommerceService } from '../application/commerce.service.js';
import {
  AcceptServiceTermsDto,
  CheckoutSessionDto,
  CreateOrderDto,
  OrderDto,
  OrderTermsDto,
  PaymentHistoryDto,
  PaymentIngestResultDto,
  PaymentReceiptDto,
  PaymentReviewDto,
  ReviewPaymentDto,
  RenewalPreviewDto,
} from './commerce.dto.js';

@ApiTags('commerce')
@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles('CUSTOMER')
@ApiBearerAuth()
export class CommerceController {
  constructor(private readonly service: CommerceService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a purchase or resume an account-owned renewal. No license secret required.' })
  @ApiCreatedResponse({ type: OrderDto })
  create(
    @CurrentUser() actor: AuthPrincipal,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto,
  ) {
    return this.service.createOrder(actor, idempotencyKey, undefined, dto);
  }

  @Get()
  @ApiOkResponse({ type: OrderDto, isArray: true })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.service.listOrders(actor);
  }

  @Get('renewal-preview/:licenseId')
  @ApiOkResponse({ type: RenewalPreviewDto })
  @ApiNotFoundResponse()
  renewalPreview(@CurrentUser() actor: AuthPrincipal, @Param('licenseId', ParseUUIDPipe) licenseId: string) {
    return this.service.renewalPreview(actor, licenseId);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderDto })
  @ApiNotFoundResponse()
  find(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOrder(actor, id);
  }

  @Get(':id/service-terms')
  @ApiOperation({ summary: 'Get the platform Service Terms content' })
  @ApiOkResponse({ type: OrderTermsDto })
  @ApiNotFoundResponse()
  serviceTerms(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getServiceTerms(actor, id);
  }

  @Post(':id/accept-service-terms')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrderDto })
  acceptServiceTerms(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptServiceTermsDto,
  ) {
    return this.service.acceptServiceTerms(actor, id, dto);
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CheckoutSessionDto })
  checkout(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.checkout(actor, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrderDto })
  cancel(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancelOrder(actor, id);
  }
}

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly service: CommerceService) {}

  @Post('ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest an idempotent payment provider event' })
  @ApiOkResponse({ type: PaymentIngestResultDto })
  ingest(
    @Body() payload: unknown,
    @Headers('x-secret-key') signature?: string,
  ) {
    return this.service.ingestIpn(payload, signature);
  }

  @Get('history')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List role-scoped durable payment evidence' })
  @ApiOkResponse({ type: PaymentHistoryDto, isArray: true })
  history(@CurrentUser() actor: AuthPrincipal) {
    return this.service.listPaymentHistory(actor);
  }

  @Get('review')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PaymentReviewDto, isArray: true })
  @ApiForbiddenResponse()
  reviewQueue(@CurrentUser() actor: AuthPrincipal) {
    return this.service.listPaymentReview(actor);
  }

  @Post('review/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PaymentReviewDto })
  @ApiNotFoundResponse()
  @ApiForbiddenResponse()
  review(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPaymentDto,
  ) {
    return this.service.reviewPayment(actor, id, dto.status, dto.reason);
  }

  @Get(':id/receipt')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_STAFF')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a receipt derived from durable matched payment evidence' })
  @ApiOkResponse({ type: PaymentReceiptDto })
  @ApiNotFoundResponse()
  getReceipt(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getPaymentReceipt(actor, id);
  }
}
