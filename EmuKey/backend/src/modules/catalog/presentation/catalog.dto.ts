import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export const BILLING_CYCLES = ['MONTHLY', 'YEARLY'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export class CreateProductDto {
  @ApiProperty({ example: 'EMUKEY_DESKTOP' })
  @IsString()
  @Length(1, 255)
  code!: string;

  @ApiProperty({ example: 'Emukey Desktop' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://picsum.photos/seed/emukey-product/1200/800' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Emukey Desktop' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://picsum.photos/seed/emukey-product/1200/800' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
}

export class CreatePlanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 'MONTHLY' })
  @IsString()
  @Length(1, 255)
  code!: string;

  @ApiProperty({ example: 'Gói tháng' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ enum: BILLING_CYCLES })
  @IsIn(BILLING_CYCLES)
  billingCycle!: BillingCycle;

  @ApiProperty({ minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMonths!: number;

  @ApiProperty({ minimum: 1, example: 120000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceVnd!: number;

  @ApiProperty({ minimum: 1, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxActiveDevices!: number;

  @ApiPropertyOptional({ example: { desktop: true } })
  @IsOptional()
  @IsObject()
  entitlements?: Record<string, unknown>;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ example: 'Gói tháng mới' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({ enum: BILLING_CYCLES })
  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMonths?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceVnd?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxActiveDevices?: number;

  @ApiPropertyOptional({ example: { desktop: true } })
  @IsOptional()
  @IsObject()
  entitlements?: Record<string, unknown>;
}

export class AdminProductDto {
  @ApiProperty() code!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) description!:
    | string
    | null;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) imageUrl!:
    | string
    | null;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  publishedAt!: string | null;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  status!: 'ARCHIVED' | 'DRAFT' | 'PUBLISHED';
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AdminPlanDto {
  @ApiProperty({ enum: BILLING_CYCLES }) billingCycle!: BillingCycle;
  @ApiProperty() code!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() durationMonths!: number;
  @ApiProperty({ type: Object }) entitlements!: Record<string, unknown>;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() maxActiveDevices!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }) planCommitment!: string;
  @ApiProperty() priceVnd!: number;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  publishedAt!: string | null;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  status!: 'ARCHIVED' | 'DRAFT' | 'PUBLISHED';
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty() version!: number;
}

export class PublicCatalogPlanDto {
  @ApiProperty({ enum: BILLING_CYCLES }) billingCycle!: BillingCycle;
  @ApiProperty() code!: string;
  @ApiProperty() durationMonths!: number;
  @ApiProperty({ type: Object }) entitlements!: Record<string, unknown>;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() maxActiveDevices!: number;
  @ApiProperty() name!: string;
  @ApiProperty() priceVnd!: number;
}

export class PublicCatalogProductDto {
  @ApiPropertyOptional({ nullable: true, type: String }) imageUrl!:
    | string
    | null;
  @ApiProperty() name!: string;
  @ApiProperty({ type: PublicCatalogPlanDto, isArray: true })
  plans!: PublicCatalogPlanDto[];
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  publishedAt!: string | null;
  @ApiProperty() slug!: string;
  @ApiProperty() summary!: string;
}

export class PlanComparisonDimensionDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Object }) values!: Record<string, unknown>;
}

export class ComparedPlanDto {
  @ApiProperty({ enum: BILLING_CYCLES }) billingCycle!: BillingCycle;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() version!: number;
}

export class ComparePlansResponseDto {
  @ApiProperty({ type: PlanComparisonDimensionDto, isArray: true })
  dimensions!: PlanComparisonDimensionDto[];
  @ApiProperty({ type: ComparedPlanDto, isArray: true }) plans!: ComparedPlanDto[];
}

export class CatalogDeleteResultDto {
  @ApiProperty() deleted!: boolean;
}
