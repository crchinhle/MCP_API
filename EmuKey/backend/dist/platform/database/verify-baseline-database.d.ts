import type { Client } from 'pg';
export interface BaselineDatabaseReport {
    constraints: number;
    extraTables: string[];
    foreignKeys: number;
    indexes: number;
    matchesBaseline: boolean;
    missingCriticalColumns: string[];
    missingCriticalConstraints: string[];
    mismatchedCriticalConstraints: string[];
    missingCriticalIndexes: string[];
    mismatchedCriticalIndexes: string[];
    mismatchedCriticalColumns: string[];
    missingExtensions: string[];
    missingTables: string[];
    tables: number;
}
export declare function verifyBaselineDatabase(database: Client): Promise<BaselineDatabaseReport>;
