import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

function errorCode(status: number): string {
  const value = HttpStatus[status];
  return typeof value === 'string' ? value : 'INTERNAL_SERVER_ERROR';
}

function publicMessage(status: number): string {
  return errorCode(status)
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function errorPayload(exception: HttpException): { code?: string; details?: unknown; message?: string } {
  const response = exception.getResponse();
  if (typeof response === 'string') return { message: response };
  if (!response || typeof response !== 'object') return {};
  const value = response as Record<string, unknown>;
  const nested = value.error;
  if (nested && typeof nested === 'object') return nested;
  const result: { code?: string; details?: unknown; message?: string } = {};
  if (typeof value.code === 'string') result.code = value.code;
  if (value.details !== undefined) result.details = value.details;
  else if (Array.isArray(value.message)) result.details = value.message;
  if (typeof value.message === 'string') result.message = value.message;
  return result;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
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
}
