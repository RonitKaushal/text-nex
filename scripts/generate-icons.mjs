/**
 * TEXTNEXUS icon pack generator
 * - Applies squircle alpha mask to master PNG
 * - Exports all required PNG sizes
 * - Builds Windows .ico (and .icns when png2icons is available)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MASTER_SRC = path.join(root, 'assets', 'icons', 'textnexus-icon-master-1024.png');

const OUT_DIR = path.join(root, 'build', 'icons');
const SIZES = [1024, 512, 256, 128, 64, 48, 32, 24, 16];
const ICO_SIZES = [256, 128, 64, 48, 32, 24, 16];

/** iOS-like continuous curvature squircle (superellipse) alpha mask */
function squircleMaskSvg(size, padding = 0) {
  const s = size;
  const inset = padding;
  const w = s - inset * 2;
  // Superellipse approx via SVG path with high corner continuity
  // Corner radius ~22% of side (macOS Big Sur-ish)
  const r = w * 0.2237;
  const x = inset;
  const y = inset;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <defs>
    <linearGradient id="edgeFade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff"/>
      <stop offset="100%" stop-color="#fff"/>
    </linearGradient>
  </defs>
  <rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${r}" ry="${r}" fill="#fff"/>
</svg>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadMaster() {
  // Prefer project-local copy if present
  const local = path.join(root, 'build', 'icons', 'icon-1024.png');
  const candidates = [MASTER_SRC, local];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Master icon not found. Looked at:\n${candidates.join('\n')}`);
}

async function applySquircleMask(inputPath, size = 1024) {
  const mask = Buffer.from(squircleMaskSvg(size));
  return sharp(inputPath)
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function resizePng(masterBuf, size) {
  // Slight unsharp for mid/small sizes to keep neon edges crisp
  const pipeline = sharp(masterBuf).resize(size, size, {
    fit: 'fill',
    kernel: sharp.kernel.lanczos3,
  });

  if (size <= 64) {
    pipeline.sharpen({ sigma: size <= 24 ? 0.8 : 0.55, m1: 0.8, m2: 0.4 });
  }

  return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function tryBuildIcns(png1024Path, outPath) {
  try {
    const png2icons = await import('png2icons');
    const input = await fs.readFile(png1024Path);
    // BICUBIC = 1
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

  const masterMasked = await applySquircleMask(masterPath, 1024);
  const masterOut = path.join(OUT_DIR, 'icon-1024.png');
  await fs.writeFile(masterOut, masterMasked);
  console.log('Wrote', masterOut);

  // Also write canonical names used by electron-builder
  await fs.writeFile(path.join(root, 'build', 'icon.png'), masterMasked);

  const sized = new Map();
  sized.set(1024, masterMasked);

  for (const size of SIZES.filter((s) => s !== 1024)) {
    const buf = await resizePng(masterMasked, size);
    sized.set(size, buf);
    const file = path.join(OUT_DIR, `icon-${size}.png`);
    await fs.writeFile(file, buf);
    console.log(`Wrote ${file} (${buf.length} bytes)`);
  }

  // Convenience copies without size suffix
  await fs.writeFile(path.join(OUT_DIR, 'icon.png'), sized.get(512));
  await fs.copyFile(path.join(OUT_DIR, 'icon-512.png'), path.join(root, 'build', 'icon.png'));

  // Windows ICO (multi-resolution)
  const icoBuffers = await Promise.all(ICO_SIZES.map((s) => sized.get(s) || resizePng(masterMasked, s)));
  const ico = await toIco(icoBuffers);
  const icoBuild = path.join(root, 'build', 'icon.ico');
  const icoPublic = path.join(root, 'public', 'icon.ico');
  const icoPack = path.join(OUT_DIR, 'icon.ico');
  await fs.writeFile(icoBuild, ico);
  await fs.writeFile(icoPublic, ico);
  await fs.writeFile(icoPack, ico);
  console.log('Wrote', icoBuild, icoPublic);

  // macOS ICNS
  const icnsOut = path.join(root, 'build', 'icon.icns');
  const icnsPack = path.join(OUT_DIR, 'icon.icns');
  const ok = await tryBuildIcns(masterOut, icnsOut);
  if (ok) {
    await fs.copyFile(icnsOut, icnsPack);
    console.log('Wrote', icnsOut);
  } else {
    // electron-builder can derive ICNS from PNG; keep 1024 PNG as source
    console.log('Place build/icon.png for electron-builder to derive ICNS if needed.');
  }

  // Manifest
  const manifest = {
    app: 'TEXTNEXUS',
    generatedAt: new Date().toISOString(),
    master: 'icon-1024.png',
    sizes: SIZES,
    files: {
      png: SIZES.map((s) => `icon-${s}.png`),
      ico: 'icon.ico',
      icns: ok ? 'icon.icns' : null,
      linux: 'icon.png (512) / icon-512.png',
    },
  };
  await fs.writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Done. Icon pack at', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
