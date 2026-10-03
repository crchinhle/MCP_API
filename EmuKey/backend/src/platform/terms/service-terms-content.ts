import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export interface ServiceTermsArtifact {
  content: string;
  hash: string;
  version: string;
}

/** Platform-wide legal content. Orders snapshot its content identity on creation. */
export class ServiceTermsContent {
  // Version is a monotonic application artefact, independent from any deployment time.
  private readonly version = 'v1';

  constructor(
    private readonly path = resolve(
      process.cwd(),
      'config',
      'service-terms.md',
    ),
  ) {}

  async loadServiceTerms(): Promise<string> {
    const content = await readFile(this.path, 'utf8');
    if (!content.trim()) throw new Error('SERVICE_TERMS_EMPTY');
    return content;
  }

  async loadServiceTermsArtifact(): Promise<ServiceTermsArtifact> {
    const content = await this.loadServiceTerms();
    return {
      content,
      hash: createHash('sha256').update(content, 'utf8').digest('hex'),
      version: this.version,
    };
  }
}
