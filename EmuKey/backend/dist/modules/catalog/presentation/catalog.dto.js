var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, IsUUID, Length, Min, } from 'class-validator';
export const BILLING_CYCLES = ['MONTHLY', 'YEARLY'];
export class CreateProductDto {
    code;
    name;
    description;
    imageUrl;
}
__decorate([
    ApiProperty({ example: 'EMUKEY_DESKTOP' }),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], CreateProductDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ example: 'Emukey Desktop' }),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], CreateProductDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "description", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://picsum.photos/seed/emukey-product/1200/800' }),
    IsOptional(),
    IsUrl({ protocols: ['https'], require_protocol: true }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "imageUrl", void 0);
export class UpdateProductDto {
    name;
    description;
    imageUrl;
}
__decorate([
    ApiPropertyOptional({ example: 'Emukey Desktop' }),
    IsOptional(),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "description", void 0);
__decorate([
    ApiPropertyOptional({ example: 'https://picsum.photos/seed/emukey-product/1200/800' }),
    IsOptional(),
    IsUrl({ protocols: ['https'], require_protocol: true }),
    __metadata("design:type", String)
], UpdateProductDto.prototype, "imageUrl", void 0);
export class CreatePlanDto {
    productId;
    code;
    name;
    billingCycle;
    durationMonths;
    priceVnd;
    maxActiveDevices;
    entitlements;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "productId", void 0);
__decorate([
    ApiProperty({ example: 'MONTHLY' }),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ example: 'Gói tháng' }),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ enum: BILLING_CYCLES }),
    IsIn(BILLING_CYCLES),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "billingCycle", void 0);
__decorate([
    ApiProperty({ minimum: 1, example: 1 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], CreatePlanDto.prototype, "durationMonths", void 0);
__decorate([
    ApiProperty({ minimum: 1, example: 120000 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], CreatePlanDto.prototype, "priceVnd", void 0);
__decorate([
    ApiProperty({ minimum: 1, example: 2 }),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], CreatePlanDto.prototype, "maxActiveDevices", void 0);
__decorate([
    ApiPropertyOptional({ example: { desktop: true } }),
    IsOptional(),
    IsObject(),
    __metadata("design:type", Object)
], CreatePlanDto.prototype, "entitlements", void 0);
export class UpdatePlanDto {
    name;
    billingCycle;
    durationMonths;
    priceVnd;
    maxActiveDevices;
    entitlements;
}
__decorate([
    ApiPropertyOptional({ example: 'Gói tháng mới' }),
    IsOptional(),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ enum: BILLING_CYCLES }),
    IsOptional(),
    IsIn(BILLING_CYCLES),
    __metadata("design:type", String)
], UpdatePlanDto.prototype, "billingCycle", void 0);
__decorate([
    ApiPropertyOptional({ minimum: 1 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], UpdatePlanDto.prototype, "durationMonths", void 0);
__decorate([
    ApiPropertyOptional({ minimum: 1 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], UpdatePlanDto.prototype, "priceVnd", void 0);
__decorate([
    ApiPropertyOptional({ minimum: 1 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    __metadata("design:type", Number)
], UpdatePlanDto.prototype, "maxActiveDevices", void 0);
__decorate([
    ApiPropertyOptional({ example: { desktop: true } }),
    IsOptional(),
    IsObject(),
    __metadata("design:type", Object)
], UpdatePlanDto.prototype, "entitlements", void 0);
export class AdminProductDto {
    code;
    createdAt;
    description;
    id;
    imageUrl;
    name;
    publishedAt;
    status;
    updatedAt;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AdminProductDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], AdminProductDto.prototype, "createdAt", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AdminProductDto.prototype, "description", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], AdminProductDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AdminProductDto.prototype, "imageUrl", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AdminProductDto.prototype, "name", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], AdminProductDto.prototype, "publishedAt", void 0);
__decorate([
    ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }),
    __metadata("design:type", String)
], AdminProductDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], AdminProductDto.prototype, "updatedAt", void 0);
export class AdminPlanDto {
    billingCycle;
    code;
    createdAt;
    durationMonths;
    entitlements;
    id;
    maxActiveDevices;
    name;
    planCommitment;
    priceVnd;
    productId;
    publishedAt;
    status;
    updatedAt;
    version;
}
__decorate([
    ApiProperty({ enum: BILLING_CYCLES }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "billingCycle", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "createdAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], AdminPlanDto.prototype, "durationMonths", void 0);
__decorate([
    ApiProperty({ type: Object }),
    __metadata("design:type", Object)
], AdminPlanDto.prototype, "entitlements", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], AdminPlanDto.prototype, "maxActiveDevices", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "planCommitment", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], AdminPlanDto.prototype, "priceVnd", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "productId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], AdminPlanDto.prototype, "publishedAt", void 0);
__decorate([
    ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], AdminPlanDto.prototype, "updatedAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], AdminPlanDto.prototype, "version", void 0);
export class PublicCatalogPlanDto {
    billingCycle;
    code;
    durationMonths;
    entitlements;
    id;
    maxActiveDevices;
    name;
    priceVnd;
}
__decorate([
    ApiProperty({ enum: BILLING_CYCLES }),
    __metadata("design:type", String)
], PublicCatalogPlanDto.prototype, "billingCycle", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PublicCatalogPlanDto.prototype, "code", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], PublicCatalogPlanDto.prototype, "durationMonths", void 0);
__decorate([
    ApiProperty({ type: Object }),
    __metadata("design:type", Object)
], PublicCatalogPlanDto.prototype, "entitlements", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], PublicCatalogPlanDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], PublicCatalogPlanDto.prototype, "maxActiveDevices", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PublicCatalogPlanDto.prototype, "name", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], PublicCatalogPlanDto.prototype, "priceVnd", void 0);
export class PublicCatalogProductDto {
    imageUrl;
    name;
    plans;
    publishedAt;
    slug;
    summary;
}
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PublicCatalogProductDto.prototype, "imageUrl", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PublicCatalogProductDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ type: PublicCatalogPlanDto, isArray: true }),
    __metadata("design:type", Array)
], PublicCatalogProductDto.prototype, "plans", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], PublicCatalogProductDto.prototype, "publishedAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PublicCatalogProductDto.prototype, "slug", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PublicCatalogProductDto.prototype, "summary", void 0);
export class PlanComparisonDimensionDto {
    key;
    label;
    values;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PlanComparisonDimensionDto.prototype, "key", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PlanComparisonDimensionDto.prototype, "label", void 0);
__decorate([
    ApiProperty({ type: Object }),
    __metadata("design:type", Object)
], PlanComparisonDimensionDto.prototype, "values", void 0);
export class ComparedPlanDto {
    billingCycle;
    id;
    name;
    productId;
    productName;
    version;
}
__decorate([
    ApiProperty({ enum: BILLING_CYCLES }),
    __metadata("design:type", String)
], ComparedPlanDto.prototype, "billingCycle", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], ComparedPlanDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], ComparedPlanDto.prototype, "name", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], ComparedPlanDto.prototype, "productId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], ComparedPlanDto.prototype, "productName", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], ComparedPlanDto.prototype, "version", void 0);
export class ComparePlansResponseDto {
    dimensions;
    plans;
}
__decorate([
    ApiProperty({ type: PlanComparisonDimensionDto, isArray: true }),
    __metadata("design:type", Array)
], ComparePlansResponseDto.prototype, "dimensions", void 0);
__decorate([
    ApiProperty({ type: ComparedPlanDto, isArray: true }),
    __metadata("design:type", Array)
], ComparePlansResponseDto.prototype, "plans", void 0);
export class CatalogDeleteResultDto {
    deleted;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], CatalogDeleteResultDto.prototype, "deleted", void 0);
//# sourceMappingURL=catalog.dto.js.map