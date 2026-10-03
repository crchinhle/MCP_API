import type {} from 'vitest/globals';

process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-32-characters-minimum';
