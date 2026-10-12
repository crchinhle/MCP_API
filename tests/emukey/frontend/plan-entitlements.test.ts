import { describe, expect, it } from 'vitest';
import { mergePlanEntitlements, splitPlanEntitlements } from '../../../EmuKey/frontend/src/presentation/screens/planEntitlements.js';

describe('plan entitlement editor', () => {
  it.each([false, 0, 'legacy'])('preserves an untouched desktop scalar %s', (originalDesktop) => {
    expect(mergePlanEntitlements(false, '{"seats":5}', originalDesktop)).toEqual({ desktop: originalDesktop, seats: 5 });
  });
  it('separates the desktop switch while retaining other scalar values', () => {
    expect(splitPlanEntitlements({ desktop: true, seats: 5, support: 'priority' })).toEqual({
      desktop: true,
      advanced: { seats: 5, support: 'priority' },
    });
  });

  it('merges desktop and advanced values and permits an explicit clear', () => {
    expect(mergePlanEntitlements(true, '{"seats":5,"support":"priority"}')).toEqual({
      desktop: true,
      seats: 5,
      support: 'priority',
    });
    expect(mergePlanEntitlements(false, '')).toEqual({});
  });

  it.each(['[]', 'null', '{"bad-key":true}', '{"nested":{"enabled":true}}', '{"ratio":1e999}'])(
    'rejects unsupported advanced entitlement JSON %s',
    (text) => {
      expect(() => mergePlanEntitlements(false, text)).toThrow();
    },
  );
});
