import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import type { PrivateStoragePort } from './private-storage.port.js';

export class LocalPrivateStorage implements PrivateStoragePort {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(key: string, content: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: 'wx', mode: 0o600 });
  }

  private path(key: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,240}$/.test(key))
      throw new Error('INVALID_STORAGE_KEY');
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`))
      throw new Error('INVALID_STORAGE_KEY');
    return path;
  }
}
