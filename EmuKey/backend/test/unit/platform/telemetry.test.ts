import { describe, expect, it, vi } from 'vitest';

import { startTelemetry } from '../../../src/platform/observability/instrumentation.js';

describe('startTelemetry', () => {
  it('does not construct an SDK when telemetry is disabled', async () => {
    const factory = vi.fn();

    const telemetry = await startTelemetry({ OTEL_ENABLED: 'false' }, factory);

    expect(factory).not.toHaveBeenCalled();
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  it('starts and exposes shutdown for an enabled SDK', async () => {
    const sdk = {
      shutdown: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
    };
    const factory = vi.fn(() => sdk);

    const telemetry = await startTelemetry({ OTEL_ENABLED: 'true' }, factory);

    expect(sdk.start).toHaveBeenCalledOnce();
    await telemetry.shutdown();
    expect(sdk.shutdown).toHaveBeenCalledOnce();
  });
});
