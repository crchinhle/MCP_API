import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

export class CreateKnowledgeDocumentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productId!: string;
  @ApiProperty({ maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9/_-]{0,179}$' }) @IsString() @Length(1, 180) @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,179}$/u) logicalDocumentKey!: string;
  @ApiProperty({ enum: ['FAQ', 'PDF', 'TXT'] }) @IsIn(['FAQ', 'PDF', 'TXT']) sourceType!: 'FAQ' | 'PDF' | 'TXT';
  @ApiProperty({ maxLength: 255 }) @IsString() @Length(1, 255) title!: string;
  @ApiPropertyOptional({ type: String, isArray: true }) @IsOptional() @IsArray() @IsString({ each: true }) chunks?: string[];
  @ApiPropertyOptional({ minimum: 1, maximum: 100 }) @IsOptional() @IsInt() @Min(1) @Max(100) version?: number;
}

export class KnowledgeDocumentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() logicalDocumentKey!: string;
  @ApiProperty() version!: number;
  @ApiProperty() status!: string;
  @ApiProperty() isCurrent!: boolean;
}

export class PublishKnowledgeDocumentDto {
  @ApiPropertyOptional({ minimum: 0, description: 'Observed current version; 0 means no published version.' }) @IsOptional() @IsInt() @Min(0) expectedCurrentVersion?: number;
}

export class KnowledgeDocumentDetailDto extends KnowledgeDocumentDto {
  @ApiProperty({ type: String, isArray: true }) chunks!: string[];
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
