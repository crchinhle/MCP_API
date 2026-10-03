import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../app.module.js';
import { ApiExceptionFilter } from '../../platform/http/api-exception.filter.js';
import { configureOpenApi } from '../../platform/http/openapi.js';
export async function createApiApplication(options = {}) {
    const loggingOptions = options.logger === false
        ? { logger: false }
        : { bufferLogs: true };
    const app = await NestFactory.create(AppModule, {
        abortOnError: false,
        ...loggingOptions,
        routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
        routeResolutionStrategy: 'specificity',
    });
    if (options.logger !== false) {
        app.useLogger(app.get(Logger));
    }
    const config = app.get(ConfigService);
    app.useBodyParser('json', { limit: '1mb', strict: true });
    app.useBodyParser('urlencoded', { extended: false, limit: '128kb' });
    app.use((request, response, next) => {
        const requestId = request.header('x-request-id')?.trim() || randomUUID();
        response.setHeader('x-request-id', requestId);
        response.removeHeader('x-powered-by');
        response.setHeader('x-content-type-options', 'nosniff');
        response.setHeader('x-frame-options', 'DENY');
        response.setHeader('referrer-policy', 'no-referrer');
        response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
        if (config.get('NODE_ENV') === 'production') {
            response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
        }
        next();
    });
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('x-powered-by', false);
    expressApp.set('trust proxy', config.get('NODE_ENV') === 'production');
    app.setGlobalPrefix('api/v1');
    app.enableCors({
        credentials: true,
        origin: config.getOrThrow('CORS_ORIGINS'),
    });
    app.useGlobalPipes(new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
    }));
    app.useGlobalFilters(new ApiExceptionFilter());
    configureOpenApi(app);
    app.enableShutdownHooks();
    return app;
}
//# sourceMappingURL=create-api-application.js.map