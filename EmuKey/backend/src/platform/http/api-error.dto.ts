import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 'NOT_FOUND' })
  code!: string;

  @ApiProperty({ example: 'Not Found' })
  message!: string;

  @ApiPropertyOptional({ description: 'Safe structured validation details.' })
  details?: unknown;

  @ApiProperty({ example: '01JREQUESTTRACE' })
  traceId!: string;
}

export class ApiErrorEnvelopeDto {
  @ApiProperty({ type: ApiErrorDto })
  error!: ApiErrorDto;
}
