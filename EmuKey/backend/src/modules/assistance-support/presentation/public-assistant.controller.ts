import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicAssistantService } from '../application/public-assistant.service.js';
import {
  PublicAiAskDto,
  PublicAiAnswerDto,
} from '../assistance-support.dto.js';

@ApiTags('public-assistant')
@Controller('public/assistant')
export class PublicAssistantController {
  constructor(private readonly service: PublicAssistantService) {}

  @Post('ask')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ask about published Catalog and approved public Knowledge in an expiring guest session',
  })
  @ApiOkResponse({ type: PublicAiAnswerDto })
  ask(@Body() dto: PublicAiAskDto, @Req() request: Request) {
    return this.service.ask(
      dto,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }
}
