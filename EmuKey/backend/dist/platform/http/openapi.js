import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorEnvelopeDto } from './api-error.dto.js';
const OPENAPI_CONFIG = new DocumentBuilder()
    .setTitle('Emukey API')
    .setDescription('Versioned API for the Emukey license platform')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
export function createOpenApiDocument(app) {
    return SwaggerModule.createDocument(app, OPENAPI_CONFIG, {
        extraModels: [ApiErrorEnvelopeDto],
    });
}
export function configureOpenApi(app) {
    SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app), {
        jsonDocumentUrl: 'api/v1/openapi.json',
    });
}
//# sourceMappingURL=openapi.js.map