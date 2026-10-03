import type { PrivateStoragePort } from './private-storage.port.js';
interface CloudinaryOptions {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folder: string;
    timeoutMs?: number;
}
export declare class CloudinaryPrivateStorage implements PrivateStoragePort {
    private readonly options;
    constructor(options: CloudinaryOptions);
    put(key: string, content: Buffer): Promise<void>;
    get(key: string): Promise<Buffer | null>;
    delete(key: string): Promise<void>;
    private publicId;
    private cloudinaryPublicId;
    private fetch;
}
export {};
