import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

export class KnowledgeCapabilitiesDto {
  @ApiProperty({ maximum: 10_485_760 }) maxFileBytes!: number;
  @ApiProperty({ type: String, isArray: true }) allowedMimeTypes!: string[];
}

export class KnowledgeChunkDto {
  @ApiProperty({ format: 'uuid' }) documentId!: string;
  @ApiProperty() documentTitle!: string;
  @ApiProperty() documentVersion!: number;
  @ApiProperty({ format: 'uuid' }) chunkId!: string;
  @ApiProperty() chunkIndex!: number;
  @ApiPropertyOptional() heading?: string;
  @ApiProperty() content!: string;
}

export class CreateKnowledgeDocumentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId!: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() planId?: string;
  @ApiProperty({ maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9/_-]{0,179}$' }) @IsString() @Length(1, 180) @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,179}$/u) logicalDocumentKey!: string;
  @ApiProperty({ enum: ['FAQ', 'PDF', 'TXT'] }) @IsIn(['FAQ', 'PDF', 'TXT']) sourceType!: 'FAQ' | 'PDF' | 'TXT';
  @ApiProperty({ maxLength: 255 }) @IsString() @Length(1, 255) title!: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @Length(1, 500) summary?: string;
  @ApiPropertyOptional({ type: String, isArray: true }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional({ type: String, isArray: true }) @IsOptional() @IsArray() @IsString({ each: true }) chunks?: string[];
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100) version?: number;
}

export class KnowledgeDocumentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid' }) providerUserId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) productId?: string;
  @ApiPropertyOptional() productName?: string;
  @ApiPropertyOptional({ format: 'uuid' }) planId?: string;
  @ApiPropertyOptional() planName?: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() summary?: string;
  @ApiProperty({ type: String, isArray: true }) tags!: string[];
  @ApiProperty() logicalDocumentKey!: string;
  @ApiProperty() version!: number;
  @ApiProperty() status!: string;
  @ApiProperty() isCurrent!: boolean;
  @ApiPropertyOptional() createdAt?: string;
  @ApiPropertyOptional() updatedAt?: string;
}

export class PublishKnowledgeDocumentDto {
  @ApiPropertyOptional({ minimum: 0, description: 'Observed current version; 0 means no published version.' }) @IsOptional() @IsInt() @Min(0) expectedCurrentVersion?: number;
}

export class KnowledgeChunkDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() chunkIndex!: number;
  @ApiPropertyOptional() heading?: string;
  @ApiProperty() content!: string;
}

export class KnowledgeDocumentDetailDto extends KnowledgeDocumentDto {
  @ApiProperty({ type: String, isArray: true }) chunks!: string[];
  @ApiPropertyOptional({ type: KnowledgeChunkDetailDto, isArray: true }) chunkDetails?: KnowledgeChunkDetailDto[];
  @ApiPropertyOptional() content?: string;
}

export class KnowledgeQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 4_000 })
  @IsString()
  @Length(1, 4_000)
  question!: string;
}

export class KnowledgeSourceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;
}

export class PublicKnowledgeQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tag?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number = 10;
}

export class PublicKnowledgeItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productName!: string;
  @ApiPropertyOptional({ format: 'uuid' }) planId?: string;
  @ApiPropertyOptional() planName?: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() summary?: string;
  @ApiProperty({ type: String, isArray: true }) tags!: string[];
  @ApiProperty() sourceType!: string;
  @ApiProperty() updatedAt!: string;
}

export class PublicKnowledgeProductFilterDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

export class PublicKnowledgeListResponseDto {
  @ApiProperty({ type: PublicKnowledgeItemDto, isArray: true }) items!: PublicKnowledgeItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty({ type: String, isArray: true }) availableTags!: string[];
  @ApiProperty({ type: PublicKnowledgeProductFilterDto, isArray: true }) products!: PublicKnowledgeProductFilterDto[];
}

export class RelatedKnowledgeDocumentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: String, isArray: true }) tags!: string[];
}

export class PublicKnowledgeDetailDto extends PublicKnowledgeItemDto {
  @ApiProperty({ type: KnowledgeChunkDetailDto, isArray: true }) chunks!: KnowledgeChunkDetailDto[];
  @ApiProperty() content!: string;
  @ApiProperty({ type: RelatedKnowledgeDocumentDto, isArray: true }) relatedDocuments!: RelatedKnowledgeDocumentDto[];
}
