import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(root, 'visual-regression', 'artifacts');
const figmaRoot = path.join(root, 'visual-regression', 'figma');
const diffRoot = path.join(root, 'visual-regression', 'diff');
await mkdir(diffRoot, { recursive: true });

const comparisons = [
  { name: 'buyer-home', route: '/buyer', node: '519:1740', fixture: 'buyer-home-fixture.png', live: 'buyer__desktop.png', reference: 'buyer-home.png' },
  { name: 'buyer-orders', route: '/buyer/orders', node: '51:453', fixture: 'buyer-orders__fixture.png', live: 'buyer__orders__desktop.png', reference: 'buyer-orders.png' },
  { name: 'buyer-licenses', route: '/buyer/licenses', node: '52:369', fixture: 'buyer-licenses__fixture.png', live: 'buyer__licenses__desktop.png', reference: 'buyer-licenses.png' },
];

const decode = async (filePath) => PNG.sync.read(await readFile(filePath));
const writePng = async (filePath, png) => writeFile(filePath, PNG.sync.write(png));
const createOverlay = (reference, code) => {
  const overlay = new PNG({ width: reference.width, height: reference.height });
  for (let index = 0; index < reference.data.length; index += 4) {
    overlay.data[index] = Math.round((reference.data[index] + code.data[index]) / 2);
    overlay.data[index + 1] = Math.round((reference.data[index + 1] + code.data[index + 1]) / 2);
    overlay.data[index + 2] = Math.round((reference.data[index + 2] + code.data[index + 2]) / 2);
    overlay.data[index + 3] = 255;
  }
  return overlay;
};

const createHeatmap = (diff) => {
  const heatmap = new PNG({ width: diff.width, height: diff.height });
  for (let index = 0; index < diff.data.length; index += 4) {
    const changed = diff.data[index] > 0 || diff.data[index + 1] > 0 || diff.data[index + 2] > 0;
    heatmap.data[index] = changed ? 220 : 255;
    heatmap.data[index + 1] = changed ? 38 : 255;
    heatmap.data[index + 2] = changed ? 38 : 255;
    heatmap.data[index + 3] = changed ? 220 : 255;
  }
  return heatmap;
};

const fileHash = async (filePath) => createHash('sha256').update(await readFile(filePath)).digest('hex');

const comparePair = async (reference, code, prefix) => {
  if (reference.width !== code.width || reference.height !== code.height) {
    return { status: 'DIMENSION_MISMATCH', referenceSize: `${reference.width}x${reference.height}`, codeSize: `${code.width}x${code.height}` };
  }
  const diff = new PNG({ width: reference.width, height: reference.height });
  const mismatchedPixels = pixelmatch(reference.data, code.data, diff.data, reference.width, reference.height, {
    threshold: 0.1,
    includeAA: false,
  });
  const totalPixels = reference.width * reference.height;
  const differencePercent = (mismatchedPixels / totalPixels) * 100;
  await writePng(`${prefix}.diff.png`, diff);
  await writePng(`${prefix}.heatmap.png`, createHeatmap(diff));
  await writePng(`${prefix}.overlay.png`, createOverlay(reference, code));
  return {
    status: differencePercent < 5 ? 'PASS_UNDER_5_PERCENT' : 'FAIL_OVER_5_PERCENT',
    width: reference.width,
    height: reference.height,
    mismatchedPixels,
    totalPixels,
    differencePercent: Number(differencePercent.toFixed(4)),
    diffImage: `${prefix}.diff.png`,
    heatmapImage: `${prefix}.heatmap.png`,
    overlayImage: `${prefix}.overlay.png`,
  };
};

const results = [];
for (const comparison of comparisons) {
  const reference = await decode(path.join(figmaRoot, comparison.reference));
  const fixture = await decode(path.join(artifactRoot, comparison.fixture));
  const live = await decode(path.join(artifactRoot, comparison.live));
  const fixturePrefix = path.join(diffRoot, `${comparison.name}__fixture`);
  const livePrefix = path.join(diffRoot, `${comparison.name}__live`);
  results.push({
    route: comparison.route,
    figmaNode: comparison.node,
    referenceFile: comparison.reference,
    fixtureFile: comparison.fixture,
    liveFile: comparison.live,
    fixture: await comparePair(reference, fixture, fixturePrefix),
    live: await comparePair(reference, live, livePrefix),
  });
}

const buyerHome = results.find((result) => result.route === '/buyer');
const writeScreenManifest = async (screen, screenName) => {
  if (!screen) return;
  const referencePath = path.join(figmaRoot, screen.referenceFile);
  const livePath = path.join(artifactRoot, screen.liveFile);
  const fixturePath = path.join(artifactRoot, screen.fixtureFile);
  const finalPrefix = path.join(diffRoot, screenName);
  await copyFile(referencePath, `${finalPrefix}-reference.png`);
  await copyFile(livePath, `${finalPrefix}-live.png`);
  await copyFile(fixturePath, `${finalPrefix}-fixture.png`);
  const captureManifest = JSON.parse(await readFile(path.join(root, 'visual-regression', 'fixtures', 'capture-manifest.json'), 'utf8'));
  const fixtureName = screen.route === '/buyer' ? 'buyer-home' : screen.route === '/buyer/orders' ? 'buyer-orders' : 'buyer-licenses';
  const fixtureRecord = captureManifest.records.find((record) => record.name === fixtureName);
  await writeFile(`${finalPrefix}-manifest.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    route: screen.route,
    figmaNode: screen.figmaNode,
    viewport: '1440x1024',
    deviceScaleFactor: 1,
    reference: { file: `${finalPrefix}-reference.png`, source: 'figma-api_download_figma_images', sha256: await fileHash(referencePath) },
    live: { file: `${finalPrefix}-live.png`, sha256: await fileHash(livePath), diff: screen.live },
    fixture: { file: `${finalPrefix}-fixture.png`, sha256: await fileHash(fixturePath), diff: screen.fixture, interception: fixtureRecord?.status === 'CAPTURED_WITH_INTERCEPT', fixtureRecord },
    artifacts: {
      overlay: `${finalPrefix}__fixture.overlay.png`,
      diff: `${finalPrefix}__fixture.diff.png`,
      heatmap: `${finalPrefix}__fixture.heatmap.png`,
    },
  }, null, 2));
};

await writeScreenManifest(buyerHome, 'buyer-home');
await writeScreenManifest(results.find((result) => result.route === '/buyer/orders'), 'buyer-orders');
await writeScreenManifest(results.find((result) => result.route === '/buyer/licenses'), 'buyer-licenses');

await writeFile(path.join(diffRoot, 'results.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  viewport: '1440x1024',
  deviceScaleFactor: 1,
  threshold: 0.1,
  includeAA: false,
  results,
}, null, 2));
console.log(JSON.stringify({ results }, null, 2));
