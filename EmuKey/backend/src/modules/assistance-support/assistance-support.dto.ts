import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, IsInt, Min } from 'class-validator';

export class SupportClaimDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) claimVersion!: number;
}
export class CloseConversationDto {
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) claimVersion?: number;
}

export class CreateConversationDto {
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

export class RequestSupportDto {
  @ApiProperty({ minLength: 1, maxLength: 1_000 })
  @IsString()
  @Length(1, 1_000)
  reason!: string;
}

export class AiAnswerDto {
  @ApiProperty({type:()=>CitationDetailDto,isArray:true}) citationDetails!: CitationDetailDto[];
  @ApiProperty()
  answer!: string;

  @ApiProperty({ isArray: true, type: String })
  citedSourceIds!: string[];

  @ApiProperty()
  grounded!: boolean;
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
