import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
export class LocalPrivateStorage {
    root;
    constructor(root) {
        this.root = resolve(root);
    }
    async delete(key) {
        await rm(this.path(key), { force: true });
    }
    async get(key) {
        try {
            return await readFile(this.path(key));
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return null;
            throw error;
        }
    }
    async put(key, content) {
        const path = this.path(key);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content, { flag: 'wx', mode: 0o600 });
    }
    path(key) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,240}$/.test(key))
            throw new Error('INVALID_STORAGE_KEY');
        const path = resolve(this.root, key);
        if (!path.startsWith(`${this.root}${sep}`))
            throw new Error('INVALID_STORAGE_KEY');
        return path;
    }
}
//# sourceMappingURL=local-private-storage.js.map