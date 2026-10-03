import type { NestExpressApplication } from '@nestjs/platform-express';
export interface CreateApiApplicationOptions {
    logger?: false;
}
export declare function createApiApplication(options?: CreateApiApplicationOptions): Promise<NestExpressApplication>;
