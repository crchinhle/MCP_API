import type { INestApplicationContext } from '@nestjs/common';
export interface CreateWorkerContextOptions {
    logger?: false;
}
export declare function createWorkerContext(options?: CreateWorkerContextOptions): Promise<INestApplicationContext>;
