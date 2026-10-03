import { startTelemetry } from '../../platform/observability/instrumentation.js';

const telemetry = await startTelemetry(process.env);
const { ConfigService } = await import('@nestjs/config');
const { createApiApplication } = await import('./create-api-application.js');
const app = await createApiApplication();
const config = app.get(ConfigService);
await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');

process.once('beforeExit', () => void telemetry.shutdown());
process.once('SIGINT', () => void telemetry.shutdown());
process.once('SIGTERM', () => void telemetry.shutdown());
