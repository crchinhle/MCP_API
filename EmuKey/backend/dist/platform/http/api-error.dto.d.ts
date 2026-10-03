export declare class ApiErrorDto {
    code: string;
    message: string;
    details?: unknown;
    traceId: string;
}
export declare class ApiErrorEnvelopeDto {
    error: ApiErrorDto;
}
