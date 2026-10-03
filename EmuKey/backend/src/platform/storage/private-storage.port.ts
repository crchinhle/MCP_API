export const PRIVATE_STORAGE = Symbol('PRIVATE_STORAGE');

export interface PrivateStoragePort {
  delete(key: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  put(key: string, content: Buffer, contentType?: string): Promise<void>;
}
