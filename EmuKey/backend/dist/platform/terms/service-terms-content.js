import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
/** Platform-wide legal content. Orders snapshot its content identity on creation. */
export class ServiceTermsContent {
    path;
    // Version is a monotonic application artefact, independent from any deployment time.
    version = 'v1';
    constructor(path = resolve(process.cwd(), 'config', 'service-terms.md')) {
        this.path = path;
    }
    async loadServiceTerms() {
        const content = await readFile(this.path, 'utf8');
        if (!content.trim())
            throw new Error('SERVICE_TERMS_EMPTY');
        return content;
    }
    async loadServiceTermsArtifact() {
        const content = await this.loadServiceTerms();
        return {
            content,
            hash: createHash('sha256').update(content, 'utf8').digest('hex'),
            version: this.version,
        };
    }
}
//# sourceMappingURL=service-terms-content.js.map