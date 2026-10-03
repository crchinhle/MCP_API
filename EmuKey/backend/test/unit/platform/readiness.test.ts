import {
  PlatformReadinessService,
  type ReadinessProbe,
} from '../../../src/platform/health/platform-readiness.service.js';

const passingProbe = (name: string): ReadinessProbe => ({
  name,
  check: () => Promise.resolve(),
});

describe('PlatformReadinessService', () => {
  it('reports every dependency when all probes succeed', async () => {
    const service = new PlatformReadinessService([
      passingProbe('postgres'),
      passingProbe('redis'),
    ]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      dependencies: {
        postgres: 'up',
        redis: 'up',
      },
    });
  });

  it('returns a redacted degraded result without exposing probe errors', async () => {
    const failingProbe: ReadinessProbe = {
      name: 'postgres',
      check: () =>
        Promise.reject(
          new Error('postgresql://user:secret@private-host/database'),
        ),
    };
    const service = new PlatformReadinessService([
      failingProbe,
      passingProbe('redis'),
    ]);

    await expect(service.check()).resolves.toEqual({
      status: 'degraded',
      dependencies: {
        postgres: 'down',
        redis: 'up',
      },
    });
  });
});
