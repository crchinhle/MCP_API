import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthPrincipal, Role } from './identity.types.js';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthPrincipal => {
  const request = context.switchToHttp().getRequest<{ user: AuthPrincipal }>();
  return request.user;
});
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const AllowActivationWithoutSession = () => SetMetadata('allowActivationWithoutSession', true);
