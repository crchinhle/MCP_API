import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SaveProviderIntegrationDto {
  @ApiProperty() @IsString() @MaxLength(2048) endpointUrl!: string;
  @ApiPropertyOptional({ writeOnly: true })
  @IsOptional()
  @IsString()
  @MinLength(24)
  @MaxLength(512)
  token?: string;
  @ApiProperty() @IsInt() @Min(0) configVersion!: number;
  @ApiProperty() @IsBoolean() authorized!: boolean;
}
export class ProviderIntegrationStateDto {
  @ApiProperty({ enum: ['ENABLE', 'DISABLE'] })
  @IsIn(['ENABLE', 'DISABLE'])
  action!: 'ENABLE' | 'DISABLE';
  @ApiProperty() @IsInt() @Min(1) configVersion!: number;
}
export class RetryProviderDeliveryDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
}

export class ProviderIntegrationViewDto {
  @ApiProperty() endpointUrl!: string;
  @ApiProperty() configVersion!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true, type: String }) verifiedAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) authorizedAt!: string | null;
  @ApiProperty() hasCredential!: boolean;
}
export class ProviderDeliveryViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() licenseId!: string;
  @ApiProperty() revision!: number;
  @ApiProperty() status!: string;
  @ApiProperty() attemptCount!: number;
  @ApiProperty({ nullable: true, type: String }) lastErrorCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) acceptedAt!: string | null;
  @ApiProperty() createdAt!: string;
}
