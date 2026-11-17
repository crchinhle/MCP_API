import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export interface ServiceTermsArtifact {
  content: string;
  hash: string;
  version: string;
}

interface ServiceTermsOptions {
  nodeEnvironment?: string | undefined;
  version?: string | undefined;
  approvedHash?: string | undefined;
}

/** Platform-wide legal content. Orders snapshot its content identity on creation. */
export class ServiceTermsContent {
  // Version is a monotonic application artefact, independent from any deployment time.
  constructor(
    private readonly path = resolve(
      process.cwd(),
      'config',
      'service-terms.md',
    ),
    private readonly options: ServiceTermsOptions = {
      nodeEnvironment: process.env.NODE_ENV,
      version: process.env.SERVICE_TERMS_VERSION,
      approvedHash: process.env.SERVICE_TERMS_APPROVED_SHA256,
    },
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.options.nodeEnvironment === 'production') await this.loadServiceTermsArtifact();
  }

  async loadServiceTerms(): Promise<string> {
    const content = await readFile(this.path, 'utf8');
    if (!content.trim()) throw new Error('SERVICE_TERMS_EMPTY');
    return content;
  }

  async loadServiceTermsArtifact(): Promise<ServiceTermsArtifact> {
    if (this.options.nodeEnvironment === 'production' &&
      (!this.options.version?.trim() || this.options.version.trim().length > 40 || !/^[a-f0-9]{64}$/i.test(this.options.approvedHash ?? ''))) {
      throw new Error('SERVICE_TERMS_APPROVAL_REQUIRED');
    }
    const content = await this.loadServiceTerms();
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    if (this.options.nodeEnvironment === 'production' && hash !== this.options.approvedHash?.toLowerCase()) {
      throw new Error('SERVICE_TERMS_APPROVAL_HASH_MISMATCH');
    }
    return {
      content,
      hash,
      version: this.options.version?.trim() || 'v1',
    };
  }
}
