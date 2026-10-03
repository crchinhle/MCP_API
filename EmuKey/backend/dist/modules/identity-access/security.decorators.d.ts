import type { Role } from './identity.types.js';
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
export declare const Roles: (...roles: Role[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const AllowActivationWithoutSession: () => import("@nestjs/common").CustomDecorator<string>;
