import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  ChangePasswordDto,
  CredentialsDto,
  EmailDto,
  ProfileDto,
  RegisterDto,
  ResetPasswordDto,
  StateDto,
  TokenDto,
} from './identity.dto.js';
import { IdentityService } from './identity.service.js';
import { CurrentUser, Roles } from './security.decorators.js';
import { AuthGuard, RolesGuard } from './security.guards.js';
import type { AuthPrincipal } from './identity.types.js';

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  private readonly cookieOptions = {
    httpOnly: true,
    maxAge: 2_592_000_000,
    path: '/api/v1/auth',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };

  constructor(private readonly service: IdentityService) {}

  @Post('register')
  @HttpCode(202)
  register(@Body() dto: RegisterDto) {
    return this.service.register(dto);
  }

  @Post('verify-email')
  @HttpCode(204)
  verifyEmail(@Body() dto: TokenDto) {
    return this.service.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(202)
  async resendVerification(@Body() dto: EmailDto) {
    await this.service.resendVerification(dto.email);
    return { accepted: true };
  }

  private setRefresh(response: Response, token: string): void {
    response.cookie('emukey_refresh', token, this.cookieOptions);
  }

  private refreshCookie(request: Request): string | undefined {
    return request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('emukey_refresh='))
      ?.slice('emukey_refresh='.length);
  }

  @Post('forgot-password')
  @HttpCode(202)
  async forgot(@Body() dto: EmailDto) {
    await this.service.forgotPassword(dto.email);
    return { accepted: true };
  }

  @Post('reset-password')
  @HttpCode(204)
  reset(@Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto.token, dto.password);
  }

  @Post('login')
  @ApiOperation({ summary: 'Issue access token and HttpOnly refresh cookie' })
  async login(
    @Body() dto: CredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.login(dto.email, dto.password);
    this.setRefresh(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.service.refresh(this.refreshCookie(request));
      this.setRefresh(response, result.refreshToken);
      return { accessToken: result.accessToken, user: result.user };
    } catch {
      response.clearCookie('emukey_refresh', { path: '/api/v1/auth' });
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Invalid session.',
      });
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.service.logout(this.refreshCookie(request));
    response.clearCookie('emukey_refresh', { path: '/api/v1/auth' });
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  profile(@CurrentUser() user: AuthPrincipal) {
    return this.service.profile(user.sub);
  }

  @Put('password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async changePassword(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.service.changePassword(
      user.sub,
      dto.currentPassword,
      dto.password,
    );
    return { changed: true };
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  profileUpdate(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ProfileDto,
  ) {
    const fields: Record<string, string | null> = {};
    if (dto.displayName !== undefined) fields.display_name = dto.displayName;
    if (dto.phone !== undefined) fields.phone = dto.phone;
    if (dto.address !== undefined) fields.address = dto.address;
    if (dto.organizationName !== undefined) {
      fields.organization_name = dto.organizationName;
    }
    return this.service.updateProfile(user, fields);
  }

  @Post('users/:id/lock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StateDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.service.changeAccountState(id, 'LOCKED', actor, dto.reason);
  }

  @Post('users/:id/unlock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StateDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.service.changeAccountState(id, 'ACTIVE', actor, dto.reason);
  }

  @Post('users/:id/disable')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  disable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StateDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.service.changeAccountState(id, 'DISABLED', actor, dto.reason);
  }

  @Get('users')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  listUsers(@Query('q') query?: string) {
    return this.service.listUsers(query);
  }

  @Get('users/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN')
  @ApiBearerAuth()
  userDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.profile(id);
  }
}
