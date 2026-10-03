import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorEnvelopeDto } from '../http/api-error.dto.js';
import { LivenessDto, ReadinessDto } from './health.dto.js';
import { PlatformReadinessService } from './platform-readiness.service.js';

@ApiTags('platform')
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: PlatformReadinessService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness' })
  @ApiOkResponse({ type: LivenessDto })
  live(): LivenessDto {
    return { status: 'ok', service: 'emukey-api' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'PostgreSQL, Redis and blockchain readiness' })
  @ApiOkResponse({ type: ReadinessDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorEnvelopeDto })
  async ready(): Promise<ReadinessDto> {
    const result = await this.readiness.check();
    if (result.status === 'degraded') {
      throw new ServiceUnavailableException();
    }
    return result;
  }
}
