import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

interface TelemetrySdk {
  shutdown(): Promise<void>;
  start(): void;
}

type TelemetrySdkFactory = () => TelemetrySdk;

export interface TelemetryHandle {
  shutdown(): Promise<void>;
}

function createTelemetrySdk(): TelemetrySdk {
  return new NodeSDK({ instrumentations: [getNodeAutoInstrumentations()] });
}

export function startTelemetry(
  environment: Record<string, string | undefined>,
  factory: TelemetrySdkFactory = createTelemetrySdk,
): Promise<TelemetryHandle> {
  if (environment.OTEL_ENABLED === 'false') {
    return Promise.resolve({ shutdown: () => Promise.resolve() });
  }
  if (environment.OTEL_ENABLED !== 'true') {
    throw new Error('OTEL_ENABLED must be true or false');
  }

  const sdk = factory();
  sdk.start();
  let stopped = false;

  return Promise.resolve({
    shutdown: async () => {
      if (!stopped) {
        stopped = true;
        await sdk.shutdown();
      }
    },
  });
}
