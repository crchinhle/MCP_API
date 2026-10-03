import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import { AiAnswerDto, AiAskDto, AppendMessageDto, ConversationDto, CreateConversationDto, MessageDto, RequestSupportDto } from './assistance-support.dto.js';
import { AssistanceSupportService } from './assistance-support.service.js';

@ApiTags('assistance')
@Controller('conversations')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class AssistanceSupportController {
  constructor(private readonly service: AssistanceSupportService) {}

  @Get()
  @Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN')
  @ApiOkResponse({ type: ConversationDto, isArray: true })
  list(@CurrentUser() actor: AuthPrincipal) { return this.service.list(actor); }

  @Get('queue')
  @Roles('SUPPORT_STAFF', 'SYSTEM_ADMIN')
  @ApiOkResponse({ type: ConversationDto, isArray: true })
  queue(@CurrentUser() actor: AuthPrincipal) { return this.service.queue(actor); }

  @Post()
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: ConversationDto })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateConversationDto) { return this.service.createConversation(actor, dto); }

  @Get(':conversationId')
  @Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN')
  @ApiOkResponse({ type: ConversationDto })
  find(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string) { return this.service.find(actor, conversationId); }

  @Post(':conversationId/messages')
  @Roles('CUSTOMER', 'SUPPORT_STAFF')
  @ApiCreatedResponse({ type: MessageDto })
  append(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string, @Body() dto: AppendMessageDto) { return this.service.appendMessage(actor, conversationId, dto); }

  @Get(':conversationId/messages')
  @Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN')
  @ApiOkResponse({ type: MessageDto, isArray: true })
  messages(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string) { return this.service.listMessages(actor, conversationId); }

  @Post(':conversationId/ai-ask')
  @Roles('CUSTOMER')
  @ApiOkResponse({ type: AiAnswerDto })
  askAi(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string, @Body() dto: AiAskDto) { return this.service.askAi(actor, conversationId, dto.question, dto.clientMessageId); }

  @Post(':conversationId/request-support')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Escalate an AI conversation to the Support queue' })
  @ApiOkResponse({ type: ConversationDto })
  requestSupport(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string, @Body() dto: RequestSupportDto) { return this.service.requestSupport(actor, conversationId, dto.reason); }

  @Get(':conversationId/messages/queue-preview')
  @Roles('SUPPORT_STAFF', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Preview messages for an unclaimed queue item' })
  @ApiOkResponse({ type: MessageDto, isArray: true })
  queuePreviewMessages(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string) { return this.service.listQueuePreviewMessages(actor, conversationId); }

  @Post(':conversationId/claim')
  @Roles('SUPPORT_STAFF')
  @ApiOkResponse({ type: ConversationDto })
  claim(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string) { return this.service.claim(actor, conversationId); }

  @Post(':conversationId/release')
  @Roles('SUPPORT_STAFF')
  @ApiOperation({ summary: 'Release a claimed conversation back to the queue' })
  @ApiOkResponse({ type: ConversationDto })
  release(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string) { return this.service.release(actor, conversationId); }

  @Post(':conversationId/close')
  @Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN')
  @ApiOkResponse({ type: ConversationDto })
  close(@CurrentUser() actor: AuthPrincipal, @Param('conversationId', ParseUUIDPipe) conversationId: string) { return this.service.close(actor, conversationId); }
}
