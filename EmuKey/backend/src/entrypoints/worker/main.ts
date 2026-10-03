import { startTelemetry } from '../../platform/observability/instrumentation.js';
import { waitForShutdown } from '../../platform/lifecycle/wait-for-shutdown.js';

const telemetry = await startTelemetry(process.env);
const { Logger } = await import('@nestjs/common');
const { createWorkerContext } = await import('./create-worker-context.js');
const context = await createWorkerContext();
const logger = new Logger('WorkerBootstrap');
logger.log({ event: 'worker.started' });

await waitForShutdown();
await context.close();
await telemetry.shutdown();
