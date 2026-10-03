import { ApiProperty } from '@nestjs/swagger';

export class LivenessDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'emukey-api' })
  service!: 'emukey-api';
}

export class ReadinessDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({
    additionalProperties: { enum: ['up', 'down'], type: 'string' },
    example: { blockchain: 'up', postgres: 'up', redis: 'up' },
    type: 'object',
  })
  dependencies!: Record<string, 'up' | 'down'>;
}
