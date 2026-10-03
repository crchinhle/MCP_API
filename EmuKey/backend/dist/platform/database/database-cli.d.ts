import pino from 'pino';
import { Client } from 'pg';
export declare const databaseCliLogger: pino.Logger<never, boolean>;
export declare function requiredEnvironment(name: string): string;
export declare function withDatabase(operation: (database: Client) => Promise<void>): Promise<void>;
