import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/;
const STRONG_PASSWORD_OPENAPI_PATTERN =
  '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).+$';
const STRONG_PASSWORD_MESSAGE =
  'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';

export class CredentialsDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, pattern: STRONG_PASSWORD_OPENAPI_PATTERN })
  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}

export class RegisterDto extends CredentialsDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @Length(1, 255)
  displayName!: string;

  @ApiProperty({ enum: ['INDIVIDUAL', 'STUDENT', 'BUSINESS'] })
  @IsIn(['INDIVIDUAL', 'STUDENT', 'BUSINESS'])
  customerType!: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
}

export class InviteProviderDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 255)
  displayName!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 255)
  organizationName!: string;

  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{40}$' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  @Matches(/^(?!0x0{40}$)/, { message: 'providerChainAddress must not be the zero address' })
  providerChainAddress!: string;

  @ApiProperty({ minLength: 1, maxLength: 100, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  providerChainNamespace!: string;
}

export class AcceptProviderInvitationDto {
  @ApiProperty({ minLength: 43, maxLength: 43 })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;

  @ApiProperty({ minLength: 12, maxLength: 128, pattern: STRONG_PASSWORD_OPENAPI_PATTERN })
  @IsString()
  @Length(12, 128)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}

export class ProviderInvitationDto extends InviteProviderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) sentAt!: string | null;
  @ApiProperty({ enum: ['PENDING', 'EXPIRED', 'ACCEPTED'] }) status!: string;
}

export class ProviderAccountDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['PROVIDER_ADMIN'] }) role!: string;
  @ApiProperty({ enum: ['ACTIVE'] }) status!: string;
}

export class TokenDto {
  @ApiProperty({ minLength: 20 })
  @IsString()
  @MinLength(20)
  token!: string;
}

export class EmailDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ minLength: 12, pattern: STRONG_PASSWORD_OPENAPI_PATTERN })
  @IsString()
  @MinLength(12)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 12, pattern: STRONG_PASSWORD_OPENAPI_PATTERN })
  @IsString()
  @MinLength(12)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;
}

export class ProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2_000)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  organizationName?: string;
}

export class StateDto {
  @ApiProperty()
  @IsString()
  @Length(3, 2_000)
  reason!: string;
}
