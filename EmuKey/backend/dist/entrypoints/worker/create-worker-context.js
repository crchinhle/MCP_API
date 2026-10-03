import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from '../../worker.module.js';
export async function createWorkerContext(options = {}) {
    const loggingOptions = options.logger === false
        ? { logger: false }
        : { bufferLogs: true };
    const context = await NestFactory.createApplicationContext(WorkerModule, loggingOptions);
    if (options.logger !== false) {
        context.useLogger(context.get(Logger));
    }
    context.enableShutdownHooks();
    return context;
}
//# sourceMappingURL=create-worker-context.js.map