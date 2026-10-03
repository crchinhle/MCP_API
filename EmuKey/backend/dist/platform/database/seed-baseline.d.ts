import type { Client } from 'pg';
type DatabaseClient = Pick<Client, 'query'>;
export declare function seedBaseline(database: DatabaseClient, seedPassword: string): Promise<void>;
export {};
