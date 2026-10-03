import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdentityService } from './identity.service.js';
export declare class AuthGuard implements CanActivate {
    private readonly service;
    constructor(service: IdentityService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare class OptionalAuthGuard implements CanActivate {
    private readonly service;
    constructor(service: IdentityService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare class RolesGuard implements CanActivate {
    private readonly reflector;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
}
