import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { 'process.env.JWT_SECRET': JSON.stringify('test-jwt-secret-32-characters-minimum') },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
    clearMocks: true,
    environment: 'node',
    globals: true,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    include: ['test/**/*.test.ts'],
  },
});
