import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeTerms, termsHash } from '../crypto/license-crypto.js';
export class TermsLoader {
    root;
    environment;
    constructor(root = resolve(process.cwd(), 'config', 'license-terms'), environment = process.env.NODE_ENV ?? 'development') {
        this.root = root;
        this.environment = environment;
    }
    async load(version) {
        if (!Number.isSafeInteger(version) || version <= 0) {
            throw new Error('Terms version must be a positive integer');
        }
        let source;
        try {
            source = await readFile(resolve(this.root, `v${version}.md`), 'utf8');
        }
        catch (error) {
            throw new Error(`Terms version ${version} is unavailable`, { cause: error });
        }
        const content = normalizeTerms(source);
        const hash = termsHash(content);
        void this.environment;
        return { content, hash, version };
    }
}
//# sourceMappingURL=terms-loader.js.map