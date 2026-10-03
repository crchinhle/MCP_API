import { createParamDecorator, SetMetadata } from '@nestjs/common';
export const CurrentUser = createParamDecorator((_, context) => {
    const request = context.switchToHttp().getRequest();
    return request.user;
});
export const Roles = (...roles) => SetMetadata('roles', roles);
export const AllowActivationWithoutSession = () => SetMetadata('allowActivationWithoutSession', true);
//# sourceMappingURL=security.decorators.js.map