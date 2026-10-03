var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Catch, HttpException, HttpStatus, } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
function errorCode(status) {
    const value = HttpStatus[status];
    return typeof value === 'string' ? value : 'INTERNAL_SERVER_ERROR';
}
function publicMessage(status) {
    return errorCode(status)
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function errorPayload(exception) {
    const response = exception.getResponse();
    if (typeof response === 'string')
        return { message: response };
    if (!response || typeof response !== 'object')
        return {};
    const value = response;
    const nested = value.error;
    if (nested && typeof nested === 'object')
        return nested;
    const result = {};
    if (typeof value.code === 'string')
        result.code = value.code;
    if (value.details !== undefined)
        result.details = value.details;
    else if (Array.isArray(value.message))
        result.details = value.message;
    if (typeof value.message === 'string')
        result.message = value.message;
    return result;
}
let ApiExceptionFilter = class ApiExceptionFilter {
    catch(exception, host) {
        const context = host.switchToHttp();
        const request = context.getRequest();
        const response = context.getResponse();
        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        const incomingTraceId = request.header('x-request-id');
        const traceId = incomingTraceId?.trim() || randomUUID();
        const payload = exception instanceof HttpException ? errorPayload(exception) : {};
        const safeMessage = status >= 500 ? publicMessage(status) : payload.message ?? publicMessage(status);
        response.status(status).json({
            error: {
                code: payload.code ?? errorCode(status),
                message: safeMessage,
                ...(payload.details === undefined ? {} : { details: payload.details }),
                traceId,
            },
        });
    }
};
ApiExceptionFilter = __decorate([
    Catch()
], ApiExceptionFilter);
export { ApiExceptionFilter };
//# sourceMappingURL=api-exception.filter.js.map