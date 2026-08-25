/**
 * Button Sender — icon pack from assets/icon-master.png
 * Usage: node scripts/build-electron-icon.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require(require.resolve('sharp', {
    paths: [
      path.join(frontendRoot, 'electron-core'),
      frontendRoot,
      path.join(frontendRoot, 'node_modules'),
    ],
  }));
} catch {
  console.warn('[icons:build] sharp not installed — skipping icon rebuild (UI build can continue).');
  process.exit(0);
}

const ICON_SIZES = [1024, 512, 256, 128, 64, 48, 32, 24, 16];
const source = path.join(frontendRoot, 'assets', 'icon-master.png');

if (!fs.existsSync(source)) {
  console.error('Missing assets/icon-master.png — add the 1024×1024 master icon there.');
  process.exit(1);
}

const iconsDir = path.join(frontendRoot, 'assets', 'icons');
const publicIconsDir = path.join(frontendRoot, 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(publicIconsDir, { recursive: true });

async function renderSize(size) {
  let pipeline = sharp(source).ensureAlpha().resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  });
  if (size <= 32) {
    pipeline = pipeline.sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 });
  }
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

console.log('Building icon pack from assets/icon-master.png\n');

for (const size of ICON_SIZES) {
  const buf = await renderSize(size);
  const name = `icon-${size}x${size}.png`;
  await sharp(buf).toFile(path.join(iconsDir, name));
  await sharp(buf).toFile(path.join(publicIconsDir, name));
  console.log(`  ✓ ${size}×${size}`);
}

await sharp(path.join(iconsDir, 'icon-1024x1024.png')).toFile(
  path.join(frontendRoot, 'assets', 'icon.png')
);

console.log('\nDone → assets/icons/* + public/icons/* + assets/icon.png');
