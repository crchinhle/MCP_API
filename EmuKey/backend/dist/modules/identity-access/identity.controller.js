var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, Res, UnauthorizedException, UseGuards, } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangePasswordDto, CredentialsDto, EmailDto, ProfileDto, RegisterDto, ResetPasswordDto, StateDto, TokenDto, } from './identity.dto.js';
import { IdentityService } from './identity.service.js';
import { CurrentUser, Roles } from './security.decorators.js';
import { AuthGuard, RolesGuard } from './security.guards.js';
let IdentityController = class IdentityController {
    service;
    cookieOptions = {
        httpOnly: true,
        maxAge: 2_592_000_000,
        path: '/api/v1/auth',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    };
    constructor(service) {
        this.service = service;
    }
    register(dto) {
        return this.service.register(dto);
    }
    verifyEmail(dto) {
        return this.service.verifyEmail(dto.token);
    }
    async resendVerification(dto) {
        await this.service.resendVerification(dto.email);
        return { accepted: true };
    }
    setRefresh(response, token) {
        response.cookie('emukey_refresh', token, this.cookieOptions);
    }
    refreshCookie(request) {
        return request.headers.cookie
            ?.split(';')
            .map((value) => value.trim())
            .find((value) => value.startsWith('emukey_refresh='))
            ?.slice('emukey_refresh='.length);
    }
    async forgot(dto) {
        await this.service.forgotPassword(dto.email);
        return { accepted: true };
    }
    reset(dto) {
        return this.service.resetPassword(dto.token, dto.password);
    }
    async login(dto, response) {
        const result = await this.service.login(dto.email, dto.password);
        this.setRefresh(response, result.refreshToken);
        return { accessToken: result.accessToken, user: result.user };
    }
    async refresh(request, response) {
        try {
            const result = await this.service.refresh(this.refreshCookie(request));
            this.setRefresh(response, result.refreshToken);
            return { accessToken: result.accessToken, user: result.user };
        }
        catch {
            response.clearCookie('emukey_refresh', { path: '/api/v1/auth' });
            throw new UnauthorizedException({
                code: 'INVALID_SESSION',
                message: 'Invalid session.',
            });
        }
    }
    async logout(request, response) {
        await this.service.logout(this.refreshCookie(request));
        response.clearCookie('emukey_refresh', { path: '/api/v1/auth' });
    }
    profile(user) {
        return this.service.profile(user.sub);
    }
    async changePassword(user, dto) {
        await this.service.changePassword(user.sub, dto.currentPassword, dto.password);
        return { changed: true };
    }
    profileUpdate(user, dto) {
        const fields = {};
        if (dto.displayName !== undefined)
            fields.display_name = dto.displayName;
        if (dto.phone !== undefined)
            fields.phone = dto.phone;
        if (dto.address !== undefined)
            fields.address = dto.address;
        if (dto.organizationName !== undefined) {
            fields.organization_name = dto.organizationName;
        }
        return this.service.updateProfile(user, fields);
    }
    lock(id, dto, actor) {
        return this.service.changeAccountState(id, 'LOCKED', actor, dto.reason);
    }
    unlock(id, dto, actor) {
        return this.service.changeAccountState(id, 'ACTIVE', actor, dto.reason);
    }
    disable(id, dto, actor) {
        return this.service.changeAccountState(id, 'DISABLED', actor, dto.reason);
    }
    listUsers(query) {
        return this.service.listUsers(query);
    }
    userDetail(id) {
        return this.service.profile(id);
    }
};
__decorate([
    Post('register'),
    HttpCode(202),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RegisterDto]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "register", null);
__decorate([
    Post('verify-email'),
    HttpCode(204),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TokenDto]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "verifyEmail", null);
__decorate([
    Post('resend-verification'),
    HttpCode(202),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EmailDto]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "resendVerification", null);
__decorate([
    Post('forgot-password'),
    HttpCode(202),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EmailDto]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "forgot", null);
__decorate([
    Post('reset-password'),
    HttpCode(204),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "reset", null);
__decorate([
    Post('login'),
    ApiOperation({ summary: 'Issue access token and HttpOnly refresh cookie' }),
    __param(0, Body()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CredentialsDto, Object]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "login", null);
__decorate([
    Post('refresh'),
    __param(0, Req()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "refresh", null);
__decorate([
    Post('logout'),
    HttpCode(204),
    __param(0, Req()),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "logout", null);
__decorate([
    Get('profile'),
    UseGuards(AuthGuard),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get the authenticated user profile' }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "profile", null);
__decorate([
    Put('password'),
    UseGuards(AuthGuard),
    ApiBearerAuth(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], IdentityController.prototype, "changePassword", null);
__decorate([
    Put('profile'),
    UseGuards(AuthGuard),
    ApiBearerAuth(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ProfileDto]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "profileUpdate", null);
__decorate([
    Post('users/:id/lock'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, StateDto, Object]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "lock", null);
__decorate([
    Post('users/:id/unlock'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, StateDto, Object]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "unlock", null);
__decorate([
    Post('users/:id/disable'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, StateDto, Object]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "disable", null);
__decorate([
    Get('users'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __param(0, Query('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "listUsers", null);
__decorate([
    Get('users/:id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IdentityController.prototype, "userDetail", null);
IdentityController = __decorate([
    ApiTags('identity'),
    Controller('auth'),
    __metadata("design:paramtypes", [IdentityService])
], IdentityController);
export { IdentityController };
//# sourceMappingURL=identity.controller.js.map