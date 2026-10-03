import { createHash } from 'node:crypto';

import type { PrivateStoragePort } from './private-storage.port.js';

interface CloudinaryOptions {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
  timeoutMs?: number;
}

export class CloudinaryPrivateStorage implements PrivateStoragePort {
  constructor(private readonly options: CloudinaryOptions) {}

  async put(key: string, content: Buffer): Promise<void> {
    const publicId = this.publicId(key);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign({ folder: this.options.folder, public_id: publicId, timestamp, type: 'authenticated' }, this.options.apiSecret);
    const form = new FormData();
    form.append('file', new Blob([content]));
    form.append('api_key', this.options.apiKey);
    form.append('folder', this.options.folder);
    form.append('public_id', publicId);
    form.append('timestamp', timestamp);
    form.append('type', 'authenticated');
    form.append('signature', signature);
    const response = await this.fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.options.cloudName)}/raw/upload`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`CLOUDINARY_UPLOAD_${response.status}`);
  }

  async get(key: string): Promise<Buffer | null> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = this.cloudinaryPublicId(key);
    const signature = sign({ public_id: publicId, timestamp, type: 'authenticated' }, this.options.apiSecret);
    const response = await this.fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.options.cloudName)}/raw/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: this.options.apiKey, public_id: publicId, timestamp, type: 'authenticated', signature }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CLOUDINARY_DOWNLOAD_${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = this.cloudinaryPublicId(key);
    const signature = sign({ public_id: publicId, timestamp, type: 'authenticated' }, this.options.apiSecret);
    const form = new URLSearchParams({ api_key: this.options.apiKey, public_id: publicId, timestamp, type: 'authenticated', signature });
    const response = await this.fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.options.cloudName)}/raw/destroy`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
    if (!response.ok) throw new Error(`CLOUDINARY_DELETE_${response.status}`);
  }

  private publicId(key: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,240}$/u.test(key)) throw new Error('INVALID_STORAGE_KEY');
    return key;
  }

  private cloudinaryPublicId(key: string): string {
    const publicId = this.publicId(key);
    return `${this.options.folder.replace(/\/+$/u, '')}/${publicId}`;
  }

  private async fetch(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function sign(params: Record<string, string | number>, secret: string): string {
  const canonical = Object.entries(params).filter(([, value]) => value !== '').sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('&');
  return createHash('sha1').update(`${canonical}${secret}`).digest('hex');
}
