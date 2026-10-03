import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AuditQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @ApiPropertyOptional({ maxLength: 120 }) @IsOptional() @IsString() @MaxLength(120) action?: string;
  @ApiPropertyOptional({ enum: ['SUCCESS', 'DENIED', 'FAILED'] }) @IsOptional() @IsIn(['SUCCESS', 'DENIED', 'FAILED']) outcome?: string;
}
export class AuditEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() action!: string;
  @ApiProperty() outcome!: string;
  @ApiProperty({ nullable: true, type: String }) actorUserId!: string | null;
  @ApiProperty({ nullable: true, type: String }) actorRole!: string | null;
  @ApiProperty({ nullable: true, type: String }) targetType!: string | null;
  @ApiProperty({ nullable: true, type: String }) targetId!: string | null;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class AuditPageDto {
  @ApiProperty({ type: AuditEntryDto, isArray: true }) items!: AuditEntryDto[];
  @ApiProperty() hasMore!: boolean;
  @ApiProperty() page!: number;
}
