import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../../src/modules/identity-access/security.guards.js';
import type { Role } from '../../src/modules/identity-access/identity.types.js';

function context(role?: string) {
  return {
    getHandler: () => context,
    getClass: () => context,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as never;
}

describe('Phase 8 authorization negative matrix', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function expectRole(role: string | undefined, allowed: Role[]) {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(allowed);
    return guard.canActivate(context(role));
  }

  it.each<readonly [string | undefined, Role[], boolean]>([
    ['CUSTOMER', ['CUSTOMER'], true],
    ['CUSTOMER', ['PROVIDER_ADMIN'], false],
    ['PROVIDER_ADMIN', ['SYSTEM_ADMIN'], false],
    ['SUPPORT_STAFF', ['SYSTEM_ADMIN'], false],
    [undefined, ['CUSTOMER'], false],
  ])('enforces %s against the route allowlist', (role, allowed, expected) => {
    expect(expectRole(role, allowed)).toBe(expected);
  });

  it('does not treat a customer role as system authority', () => {
    expect(expectRole('CUSTOMER', ['SYSTEM_ADMIN'])).toBe(false);
  });
});
