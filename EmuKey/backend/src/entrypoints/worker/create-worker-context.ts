import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { WorkerModule } from '../../worker.module.js';

export interface CreateWorkerContextOptions {
  logger?: false;
}

export async function createWorkerContext(
  options: CreateWorkerContextOptions = {},
): Promise<INestApplicationContext> {
  const loggingOptions =
    options.logger === false
      ? ({ logger: false } as const)
      : ({ bufferLogs: true } as const);
  const context = await NestFactory.createApplicationContext(
    WorkerModule,
    loggingOptions,
  );
  if (options.logger !== false) {
    context.useLogger(context.get(Logger));
  }
  context.enableShutdownHooks();
  return context;
}
