import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import { CreateKnowledgeDocumentDto, KnowledgeCapabilitiesDto, KnowledgeChunkDto, KnowledgeDocumentDetailDto, KnowledgeDocumentDto, KnowledgeQueryDto, KnowledgeSourceDto, PublishKnowledgeDocumentDto } from './knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';

@ApiTags('knowledge') @Controller('knowledge') @UseGuards(AuthGuard, RolesGuard) @ApiBearerAuth()
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}
  @Get('capabilities') @Roles('PROVIDER_ADMIN','SYSTEM_ADMIN')
  @ApiOkResponse({ type: KnowledgeCapabilitiesDto })
  capabilities(@CurrentUser() actor:AuthPrincipal) {return this.service.capabilities(actor);}
  @Get('documents/:id/chunks/:chunkId') @Roles('CUSTOMER','PROVIDER_ADMIN','SYSTEM_ADMIN')
  @ApiOkResponse({ type: KnowledgeChunkDto })
  chunk(@CurrentUser() actor:AuthPrincipal,@Param('id',ParseUUIDPipe) id:string,@Param('chunkId',ParseUUIDPipe) chunkId:string) {return this.service.chunk(actor,id,chunkId);}
  @Get('documents') @Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeDocumentDto, isArray: true }) list(@CurrentUser() actor: AuthPrincipal) { return this.service.list(actor); }
  @Post('documents') @Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10_485_760}})) @ApiCreatedResponse({ type: KnowledgeDocumentDto }) create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateKnowledgeDocumentDto, @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }) { return this.service.create(actor, { ...dto, ...(file ? { file } : {}) }); }
  @Get('documents/:id') @Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeDocumentDetailDto }) detail(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) { return this.service.detail(actor, id); }
  @Post('documents/:id/publish') @HttpCode(200) @Roles('SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeDocumentDto }) publish(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishKnowledgeDocumentDto) { return this.service.publish(actor, id, dto.expectedCurrentVersion); }
  @Post('query') @HttpCode(200) @Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN') @ApiOkResponse({ type: KnowledgeSourceDto, isArray: true }) query(@CurrentUser() actor: AuthPrincipal, @Body() dto: KnowledgeQueryDto) { return this.service.search(actor, dto.question); }
}
