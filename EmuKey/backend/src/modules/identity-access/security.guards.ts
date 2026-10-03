import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from './identity.service.js';
import type { Role } from './identity.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly service: IdentityService) {}
  async canActivate(context: ExecutionContext) { const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: unknown }>(); const header = request.headers.authorization; if (!header?.startsWith('Bearer ')) throw new UnauthorizedException(); try { request.user = await this.service.authenticate(header.slice(7)); return true; } catch { throw new UnauthorizedException(); } }
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly service: IdentityService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: unknown }>();
    const header = request.headers.authorization;
    if (!header) return true;
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException();
    try { request.user = await this.service.authenticate(header.slice(7)); return true; } catch { throw new UnauthorizedException(); }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) { const roles = this.reflector.getAllAndOverride<Role[]>('roles', [context.getHandler(), context.getClass()]); const user = context.switchToHttp().getRequest<{ user?: { role?: Role } }>().user; return !roles?.length || (user?.role !== undefined && roles.includes(user.role)); }
}
