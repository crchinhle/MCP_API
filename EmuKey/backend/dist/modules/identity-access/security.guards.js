var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from './identity.service.js';
let AuthGuard = class AuthGuard {
    service;
    constructor(service) {
        this.service = service;
    }
    async canActivate(context) { const request = context.switchToHttp().getRequest(); const header = request.headers.authorization; if (!header?.startsWith('Bearer '))
        throw new UnauthorizedException(); try {
        request.user = await this.service.authenticate(header.slice(7));
        return true;
    }
    catch {
        throw new UnauthorizedException();
    } }
};
AuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [IdentityService])
], AuthGuard);
export { AuthGuard };
let OptionalAuthGuard = class OptionalAuthGuard {
    service;
    constructor(service) {
        this.service = service;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const header = request.headers.authorization;
        if (!header)
            return true;
        if (!header.startsWith('Bearer '))
            throw new UnauthorizedException();
        try {
            request.user = await this.service.authenticate(header.slice(7));
            return true;
        }
        catch {
            throw new UnauthorizedException();
        }
    }
};
OptionalAuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [IdentityService])
], OptionalAuthGuard);
export { OptionalAuthGuard };
let RolesGuard = class RolesGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) { const roles = this.reflector.getAllAndOverride('roles', [context.getHandler(), context.getClass()]); const user = context.switchToHttp().getRequest().user; return !roles?.length || (user?.role !== undefined && roles.includes(user.role)); }
};
RolesGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [Reflector])
], RolesGuard);
export { RolesGuard };
//# sourceMappingURL=security.guards.js.map