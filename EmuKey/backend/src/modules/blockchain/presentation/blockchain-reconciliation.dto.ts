import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class BlockchainHealthDto {
  @ApiProperty() active_without_finality!: number;
  @ApiProperty() pending_events!: number;
  @ApiProperty() reorged_events!: number;
  @ApiProperty() unknown_commands!: number;
}

export class BlockchainProjectionRepairDto {
  @ApiProperty() commandRepairs!: number;
  @ApiProperty({ isArray: true, type: String }) licenseIds!: string[];
  @ApiProperty() licenseRepairs!: number;
  @ApiProperty() remainingMismatches!: number;
}

export class BlockchainReconciliationDto {
  @ApiProperty({ type: BlockchainHealthDto }) health!: BlockchainHealthDto;
  @ApiProperty() indexedEvents!: number;
  @ApiProperty() processed!: boolean;
  @ApiProperty({ type: BlockchainProjectionRepairDto })
  projection!: BlockchainProjectionRepairDto;
  @ApiProperty({ isArray: true, type: String }) reconciledCommandIds!: string[];
}

export class DeadLetterRecoveryDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;

  @ApiProperty({ enum: ['REQUEUE_NO_SUBMISSION', 'RECONCILE_SAME_RAW', 'ABANDON_REVERTED', 'ABANDON_NO_EFFECT'] })
  @IsIn(['REQUEUE_NO_SUBMISSION', 'RECONCILE_SAME_RAW', 'ABANDON_REVERTED', 'ABANDON_NO_EFFECT'])
  mode!: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT';

  @ApiProperty({ minLength: 3, maxLength: 2_000 })
  @IsString()
  @Length(3, 2_000)
  reason!: string;
}
