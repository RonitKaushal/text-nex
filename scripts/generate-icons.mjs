/**
 * ArcticSwitch icon pack generator
 * Master: public/logo_light.png (transparent diamond)
 * Exports PNG sizes, Windows .ico, and .icns when png2icons is available
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MASTER_CANDIDATES = [
  path.join(root, 'public', 'logo_light.png'),
  path.join(root, 'assets', 'icons', 'arcticswitch-icon-master-1024.png'),
  path.join(root, 'build', 'icons', 'icon-1024.png'),
];

const OUT_DIR = path.join(root, 'build', 'icons');
const SIZES = [1024, 512, 256, 128, 64, 48, 32, 24, 16];
const ICO_SIZES = [256, 128, 64, 48, 32, 24, 16];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadMaster() {
  for (const c of MASTER_CANDIDATES) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Master icon not found. Looked at:\n${MASTER_CANDIDATES.join('\n')}`);
}

async function resizePng(inputPathOrBuf, size) {
  const pipeline = sharp(inputPathOrBuf)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha();

  if (size <= 64) {
    pipeline.sharpen({ sigma: size <= 24 ? 0.8 : 0.55, m1: 0.8, m2: 0.4 });
  }

  return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function tryBuildIcns(png1024Path, outPath) {
  try {
    const png2icons = await import('png2icons');
    const input = await fs.readFile(png1024Path);
    const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0);
    if (!icns) throw new Error('png2icons returned empty ICNS');
    await fs.writeFile(outPath, icns);
    return true;
  } catch (err) {
    console.warn('ICNS build skipped:', err.message || err);
    return false;
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(path.join(root, 'public'));
  await ensureDir(path.join(root, 'build'));

  const masterPath = await loadMaster();
  console.log('Master:', masterPath);

  const masterBuf = await resizePng(masterPath, 1024);
  const masterOut = path.join(OUT_DIR, 'icon-1024.png');
  await fs.writeFile(masterOut, masterBuf);
  await fs.writeFile(path.join(root, 'build', 'icon.png'), masterBuf);
  await fs.writeFile(path.join(OUT_DIR, '1024x1024.png'), masterBuf);
  console.log('Wrote', masterOut);

  const sized = new Map();
  sized.set(1024, masterBuf);

  for (const size of SIZES.filter((s) => s !== 1024)) {
    const buf = await resizePng(masterBuf, size);
    sized.set(size, buf);
    const file = path.join(OUT_DIR, `icon-${size}.png`);
    await fs.writeFile(file, buf);
    if (size === 512 || size === 256) {
      await fs.writeFile(path.join(OUT_DIR, `${size}x${size}.png`), buf);
    }
    console.log(`Wrote ${file}`);
  }

  await fs.writeFile(path.join(OUT_DIR, 'icon.png'), sized.get(512));
  await fs.writeFile(path.join(root, 'public', 'logo.png'), sized.get(512));
  await fs.writeFile(path.join(root, 'public', 'favicon-32.png'), sized.get(32));
  await fs.writeFile(path.join(root, 'public', 'favicon-16.png'), sized.get(16));

  const icoBuffers = await Promise.all(ICO_SIZES.map((s) => sized.get(s)));
  const ico = await toIco(icoBuffers);
  const icoBuild = path.join(root, 'build', 'icon.ico');
  const icoPublic = path.join(root, 'public', 'icon.ico');
  const icoPack = path.join(OUT_DIR, 'icon.ico');
  await fs.writeFile(icoBuild, ico);
  await fs.writeFile(icoPublic, ico);
  await fs.writeFile(icoPack, ico);
  console.log('Wrote', icoBuild, icoPublic);

  const icnsOut = path.join(root, 'build', 'icon.icns');
  const icnsPack = path.join(OUT_DIR, 'icon.icns');
  const ok = await tryBuildIcns(masterOut, icnsOut);
  if (ok) {
    await fs.copyFile(icnsOut, icnsPack);
    console.log('Wrote', icnsOut);
  } else {
    console.log('Mac builds will derive ICNS from build/icon.png via electron-builder.');
  }

  const manifest = {
    app: 'ARCTICSWITCH',
    generatedAt: new Date().toISOString(),
    master: 'logo_light.png',
    sizes: SIZES,
    files: {
      png: SIZES.map((s) => `icon-${s}.png`),
      ico: 'icon.ico',
      icns: ok ? 'icon.icns' : null,
    },
  };
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Done. Icon pack at', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
