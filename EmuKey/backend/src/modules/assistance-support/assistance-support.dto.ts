import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

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
  @ApiProperty()
  answer!: string;

  @ApiProperty({ isArray: true, type: String })
  citedSourceIds!: string[];

  @ApiProperty()
  grounded!: boolean;
}

export class ConversationDto {
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
