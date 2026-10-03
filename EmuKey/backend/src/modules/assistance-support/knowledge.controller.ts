import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import { CreateKnowledgeDocumentDto, KnowledgeDocumentDetailDto, KnowledgeDocumentDto, KnowledgeQueryDto, KnowledgeSourceDto, PublishKnowledgeDocumentDto } from './knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';

@ApiTags('knowledge') @Controller('knowledge') @UseGuards(AuthGuard, RolesGuard) @ApiBearerAuth()
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}
  @Get('documents') @Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeDocumentDto, isArray: true }) list(@CurrentUser() actor: AuthPrincipal) { return this.service.list(actor); }
  @Post('documents') @Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN') @UseInterceptors(FileInterceptor('file')) @ApiOkResponse({ type: KnowledgeDocumentDto }) create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateKnowledgeDocumentDto, @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }) { return this.service.create(actor, { ...dto, ...(file ? { file } : {}) }); }
  @Get('documents/:id') @Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeDocumentDetailDto }) detail(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) { return this.service.detail(actor, id); }
  @Post('documents/:id/publish') @Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeDocumentDto }) publish(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishKnowledgeDocumentDto) { return this.service.publish(actor, id, dto.expectedCurrentVersion); }
  @Post('query') @Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeSourceDto, isArray: true }) query(@CurrentUser() actor: AuthPrincipal, @Body() dto: KnowledgeQueryDto) { return this.service.search(actor, dto.question); }
}
