import { describe, expect, it } from 'vitest';

import { chunkText } from '../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/knowledge.repository.js';

describe('UTF-8-safe chunking (KNW-05)', () => {
  it('chunks by byte budget, not code unit count', () => {
    const vietnamese = 'Phượng Hoàng '.repeat(1000);
    const chunks = chunkText(vietnamese, 100);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(100);
    }
  });

  it('does not split multi-byte characters', () => {
    const text = 'A'.repeat(50) + 'Ế' + 'B'.repeat(50);
    const chunks = chunkText(text, 53);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(53);
      expect(chunk.includes('\u0000')).toBe(false);
    }
    expect(chunks.join('')).toBe(text);
  });

  it('rejects a code point that exceeds the configured byte budget', () => {
    expect(() => chunkText('😀', 3)).toThrow('KNOWLEDGE_CHUNK_LIMIT');
  });

  it('normalizes null bytes and trims the input', () => {
    expect(chunkText('  hello\u0000world  ')).toEqual(['helloworld']);
  });

  it('returns empty when the input is blank', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });
});