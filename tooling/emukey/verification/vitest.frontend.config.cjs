const { createRequire } = require('node:module');
const { resolve } = require('node:path');

const productRoot = resolve(__dirname, '..', '..', '..', 'EmuKey', 'frontend');
const workspaceRoot = resolve(productRoot, '..', '..');
const testsRoot = resolve(workspaceRoot, 'tests', 'emukey', 'frontend');
const requireFromProduct = createRequire(resolve(productRoot, 'package.json'));
const { defineConfig } = requireFromProduct('vitest/config');
const react = requireFromProduct('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react.default ?? react],
  root: testsRoot,
  server: {
    fs: { allow: [productRoot, workspaceRoot] },
  },
  resolve: {
    alias: [
      { find: /^react$/, replacement: requireFromProduct.resolve('react') },
      { find: /^react\/jsx-dev-runtime$/, replacement: requireFromProduct.resolve('react/jsx-dev-runtime') },
      { find: /^react\/jsx-runtime$/, replacement: requireFromProduct.resolve('react/jsx-runtime') },
      { find: /^react-dom$/, replacement: requireFromProduct.resolve('react-dom') },
      { find: /^react-router-dom$/, replacement: requireFromProduct.resolve('react-router-dom') },
      { find: /^@tanstack\/react-query$/, replacement: requireFromProduct.resolve('@tanstack/react-query') },
      { find: /^@testing-library\/react$/, replacement: requireFromProduct.resolve('@testing-library/react') },
      { find: /^@testing-library\/user-event$/, replacement: requireFromProduct.resolve('@testing-library/user-event') },
      { find: /^antd$/, replacement: requireFromProduct.resolve('antd') },
    ],
  },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    setupFiles: [resolve(testsRoot, 'setup.ts')],
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
