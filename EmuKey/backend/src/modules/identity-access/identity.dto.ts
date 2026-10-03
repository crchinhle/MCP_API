import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
