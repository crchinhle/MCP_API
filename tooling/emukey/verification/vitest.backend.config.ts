import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const testsRoot = resolve(import.meta.dirname, '../../../tests/emukey/backend');
const productRoot = resolve(import.meta.dirname, '../../../EmuKey/backend');

export default defineConfig({
  define: { 'process.env.JWT_SECRET': JSON.stringify('test-jwt-secret-32-characters-minimum') },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  root: productRoot,
  test: {
    setupFiles: [resolve(testsRoot, 'setup.ts')],
    clearMocks: true,
    environment: 'node',
    globals: true,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    include: [resolve(testsRoot, '**/*.test.ts').replaceAll('\\', '/')],
  },
});
