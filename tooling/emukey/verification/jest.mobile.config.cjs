const { resolve } = require('node:path');
const root = resolve(__dirname, '../../../EmuKey/mobile');
module.exports = {
  rootDir: root,
  preset: 'jest-expo',
  modulePaths: [resolve(root, 'node_modules'), resolve(root, 'node_modules/.pnpm/node_modules')],
  roots: [root, resolve(__dirname, '../../../tests/emukey/mobile')],
  setupFilesAfterEnv: [resolve(__dirname, '../../../tests/emukey/mobile/setup.ts')],
  testMatch: [resolve(__dirname, '../../../tests/emukey/mobile/**/*.test.ts?(x)').replaceAll('\\', '/')],
};
