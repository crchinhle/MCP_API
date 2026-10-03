import type { PrivateStoragePort } from './private-storage.port.js';
export declare class LocalPrivateStorage implements PrivateStoragePort {
    private readonly root;
    constructor(root: string);
    delete(key: string): Promise<void>;
    get(key: string): Promise<Buffer | null>;
    put(key: string, content: Buffer): Promise<void>;
    private path;
}
