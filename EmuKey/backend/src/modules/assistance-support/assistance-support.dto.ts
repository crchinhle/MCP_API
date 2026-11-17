import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, IsInt, Min } from 'class-validator';

export class SupportClaimDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) claimVersion!: number;
}
export class CloseConversationDto {
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) claimVersion?: number;
}

export class CreateConversationDto {
  @ApiPropertyOptional({ enum: ['AI', 'SUPPORT'], default: 'AI' })
  @IsOptional() @IsIn(['AI', 'SUPPORT'])
  mode?: 'AI' | 'SUPPORT';

  @ApiPropertyOptional({ format: 'uuid', description: 'Stable creation intent key; required for SUPPORT.' })
  @IsOptional() @IsUUID()
  clientRequestId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 8_000, description: 'Required for SUPPORT.' })
  @IsOptional() @IsString() @Length(1, 8_000)
  initialMessage?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  contextId?: string;

  @ApiPropertyOptional({ enum: ['GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE'] })
  @IsOptional()
  @IsIn(['GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE'])
  contextType?: 'GENERAL' | 'PRODUCT' | 'PLAN' | 'ORDER' | 'LICENSE';

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class AppendMessageDto {
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) claimVersion?: number;
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientMessageId!: string;

  @ApiProperty({ minLength: 1, maxLength: 8_000 })
  @IsString()
  @Length(1, 8_000)
  content!: string;
}

export class AiAskDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientMessageId!: string;

  @ApiProperty({ minLength: 1, maxLength: 4_000 })
  @IsString()
  @Length(1, 4_000)
  question!: string;
}

export class PublicAiAskDto extends AiAskDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() sessionId?: string;
}

export class RequestSupportDto {
  @ApiProperty({ minLength: 1, maxLength: 1_000 })
  @IsString()
  @Length(1, 1_000)
  reason!: string;
}

export class AiAnswerDto {
  @ApiPropertyOptional({ enum: ['PRODUCT_QA', 'USAGE_GUIDANCE', 'PRODUCT_RECOMMENDATION', 'FOLLOW_UP', 'SUPPORT_REQUIRED', 'OUT_OF_SCOPE'] }) intent?: string;
  @ApiPropertyOptional({ enum: ['ANSWERED', 'CLARIFICATION', 'NO_SOURCES', 'OUT_OF_SCOPE', 'SUPPORT_REQUIRED', 'PROVIDER_UNAVAILABLE'] }) outcome?: string;
  @ApiPropertyOptional({ type: () => CatalogSourceDto, isArray: true }) catalogSources?: CatalogSourceDto[];
  @ApiPropertyOptional({ type: () => CatalogSourceDto, isArray: true }) recommendations?: CatalogSourceDto[];
  @ApiProperty({type:()=>CitationDetailDto,isArray:true}) citationDetails!: CitationDetailDto[];
  @ApiProperty()
  answer!: string;

  @ApiProperty({ isArray: true, type: String })
  citedSourceIds!: string[];

  @ApiProperty()
  grounded!: boolean;
}

export class PublicAiAnswerDto extends AiAnswerDto {
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
}

export class CatalogSourceDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CATALOG'] }) kind!: 'CATALOG';
  @ApiProperty() content!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productCode!: string;
  @ApiProperty() productName!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() planName!: string;
  @ApiProperty() priceVnd!: number;
  @ApiProperty() maxActiveDevices!: number;
  @ApiProperty() durationMonths!: number;
  @ApiProperty({ type: 'object', additionalProperties: true }) entitlements!: Record<string, unknown>;
  @ApiPropertyOptional({ enum: ['VECTOR', 'LEXICAL'] }) retrievalMethod?: string;
}

export class ConversationDto {
  @ApiProperty() claimVersion!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) claimExpiresAt!: string | null;
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  customerUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  assignedSupportUserId!: string | null;

  @ApiProperty({ enum: ['AI_ACTIVE', 'WAITING_SUPPORT', 'SUPPORT_ACTIVE', 'CLOSED'] })
  status!: string;

  @ApiProperty({ enum: ['GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE'] })
  contextType!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  contextId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;
}

export class MessageDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
  @ApiPropertyOptional() intent?: string;
  @ApiPropertyOptional() outcome?: string;
  @ApiPropertyOptional({ type: () => CatalogSourceDto, isArray: true }) catalogSources?: CatalogSourceDto[];
  @ApiPropertyOptional({ type: () => CatalogSourceDto, isArray: true }) recommendations?: CatalogSourceDto[];
  @ApiProperty({type:()=>CitationDetailDto,isArray:true}) citationDetails!: CitationDetailDto[];
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ format: 'uuid' })
  clientMessageId!: string;

  @ApiProperty()
  serverSequence!: number;

  @ApiProperty({ enum: ['CUSTOMER', 'SUPPORT', 'AI', 'SYSTEM'] })
  senderType!: string;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({ nullable: true })
  grounded?: boolean | null;

  @ApiPropertyOptional({ type: String, isArray: true })
  sources?: string[];
}

export class CitationDetailDto {
  @ApiProperty({format:'uuid'}) chunkId!:string;
  @ApiProperty({format:'uuid'}) documentId!:string;
  @ApiProperty() documentTitle!:string;
  @ApiProperty() documentVersion!:number;
  @ApiProperty() excerpt!:string;
  @ApiProperty() chunkIndex!:number;
}
