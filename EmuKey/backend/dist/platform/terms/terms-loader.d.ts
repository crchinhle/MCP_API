import type { Hex } from 'viem';
export interface LicenseTerms {
    content: string;
    hash: Hex;
    version: number;
}
export declare class TermsLoader {
    private readonly root;
    private readonly environment;
    constructor(root?: string, environment?: string);
    load(version: number): Promise<LicenseTerms>;
}
