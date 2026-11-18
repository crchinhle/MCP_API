import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

import { startTelemetry } from '../../../../../EmuKey/backend/src/platform/observability/instrumentation.js';

describe('startTelemetry', () => {
  it('preserves metadata headers, JSON parsing and rejection through the installed telemetry HTTP client', async () => {
    const product = createRequire(new URL('../../../../../EmuKey/backend/package.json', import.meta.url));
    const auto = createRequire(product.resolve('@opentelemetry/auto-instrumentations-node'));
    const detector = createRequire(auto.resolve('@opentelemetry/resource-detector-gcp'));
    const metadata = detector('gcp-metadata') as { instance(property: string): Promise<unknown> };
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(`${request.url}:${request.headers['metadata-flavor']}`);
      if (request.url?.endsWith('/invalid')) response.end('not trusted metadata');
      else {
        response.setHeader('Metadata-Flavor', 'Google');
        response.end('{"zone":"fixture-zone"}');
      }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected loopback TCP address');
    vi.stubEnv('GCE_METADATA_IP', `127.0.0.1:${address.port}`);
    try {
      await expect(metadata.instance('zone')).resolves.toEqual({ zone: 'fixture-zone' });
      await expect(metadata.instance('invalid')).rejects.toThrow(/incorrect Metadata-Flavor header/i);
      expect(requests).toEqual([
        '/computeMetadata/v1/instance/zone:Google',
        '/computeMetadata/v1/instance/invalid:Google',
      ]);
    } finally {
      vi.unstubAllEnvs();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

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
