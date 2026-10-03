export declare const PRIVATE_STORAGE: unique symbol;
export interface PrivateStoragePort {
    delete(key: string): Promise<void>;
    get(key: string): Promise<Buffer | null>;
    put(key: string, content: Buffer, contentType?: string): Promise<void>;
}
