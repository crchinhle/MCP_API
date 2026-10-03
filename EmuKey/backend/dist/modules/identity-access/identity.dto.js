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
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength, } from 'class-validator';
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/;
const STRONG_PASSWORD_OPENAPI_PATTERN = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).+$';
const STRONG_PASSWORD_MESSAGE = 'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
export class CredentialsDto {
    email;
    password;
}
__decorate([
    ApiProperty({ format: 'email' }),
    IsEmail(),
    __metadata("design:type", String)
], CredentialsDto.prototype, "email", void 0);
__decorate([
    ApiProperty({ minLength: 8, pattern: STRONG_PASSWORD_OPENAPI_PATTERN }),
    IsString(),
    MinLength(8),
    Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE }),
    __metadata("design:type", String)
], CredentialsDto.prototype, "password", void 0);
export class RegisterDto extends CredentialsDto {
    displayName;
    customerType;
}
__decorate([
    ApiProperty({ minLength: 1, maxLength: 255 }),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], RegisterDto.prototype, "displayName", void 0);
__decorate([
    ApiProperty({ enum: ['INDIVIDUAL', 'STUDENT', 'BUSINESS'] }),
    IsIn(['INDIVIDUAL', 'STUDENT', 'BUSINESS']),
    __metadata("design:type", String)
], RegisterDto.prototype, "customerType", void 0);
export class TokenDto {
    token;
}
__decorate([
    ApiProperty({ minLength: 20 }),
    IsString(),
    MinLength(20),
    __metadata("design:type", String)
], TokenDto.prototype, "token", void 0);
export class EmailDto {
    email;
}
__decorate([
    ApiProperty({ format: 'email' }),
    IsEmail(),
    __metadata("design:type", String)
], EmailDto.prototype, "email", void 0);
export class ResetPasswordDto {
    token;
    password;
}
__decorate([
    ApiProperty(),
    IsString(),
    MinLength(20),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    ApiProperty({ minLength: 12, pattern: STRONG_PASSWORD_OPENAPI_PATTERN }),
    IsString(),
    MinLength(12),
    Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "password", void 0);
export class ChangePasswordDto {
    currentPassword;
    password;
}
__decorate([
    ApiProperty({ minLength: 1 }),
    IsString(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    ApiProperty({ minLength: 12, pattern: STRONG_PASSWORD_OPENAPI_PATTERN }),
    IsString(),
    MinLength(12),
    Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE }),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "password", void 0);
export class ProfileDto {
    displayName;
    phone;
    address;
    organizationName;
}
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], ProfileDto.prototype, "displayName", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    Length(0, 30),
    __metadata("design:type", String)
], ProfileDto.prototype, "phone", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    Length(0, 2_000),
    __metadata("design:type", String)
], ProfileDto.prototype, "address", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    Length(0, 255),
    __metadata("design:type", String)
], ProfileDto.prototype, "organizationName", void 0);
export class StateDto {
    reason;
}
__decorate([
    ApiProperty(),
    IsString(),
    Length(3, 2_000),
    __metadata("design:type", String)
], StateDto.prototype, "reason", void 0);
//# sourceMappingURL=identity.dto.js.map