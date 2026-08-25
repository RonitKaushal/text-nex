/**
 * Prepare obfuscated Bulk WhatsApp + Lead Gen trees for TextNexus packaging.
 * Output: build-protected/  (plain source never shipped in installer)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build-protected');

const OBFUSCATE_OPTS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  target: 'node',
};

/** Drop browser caches, docs, tests — shrinks installer without breaking runtime */
const NM_IGNORE_DIRS = new Set([
  '.cache',
  '.local-chromium',
  '.local-browsers',
  'chrome',
  'chrome-headless-shell',
  'chrome-win',
  'chrome-win64',
  'test',
  'tests',
  '__tests__',
  'docs',
  'doc',
  'example',
  'examples',
  'powered-test',
  '.github',
  'coverage',
  'benchmark',
  'benchmarks',
  'man',
  'testdata',
  'fixtures',
]);

const NM_SKIP_TOP = new Set([
  'electron',
  'electron-builder',
  'app-builder-bin',
  'app-builder-lib',
  '7zip-bin',
  'typescript',
  'dmg-builder',
  'electron-publish',
  '@electron',
  '@types',
  'cross-env',
  'eslint',
  'vite',
  'esbuild',
  '@vitejs',
  'concurrently',
  'wait-on',
  'rimraf',
]);

const NM_SKIP_FILE_RE = /\.(md|markdown|map|ts|tsx|flow|coffee|yml|yaml)$/i;
const NM_KEEP_FILE_RE = /\.d\.ts$/i;

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function shouldIgnoreNmEntry(name, isDirectory) {
  if (NM_IGNORE_DIRS.has(name)) return true;
  if (name === '.bin') return true;
  if (isDirectory) return false;
  // Never strip runtime JS/JSON/native — only docs/maps/types
  if (NM_KEEP_FILE_RE.test(name)) return true; // .d.ts
  if (NM_SKIP_FILE_RE.test(name)) return true; // .md .map .ts etc.
  // Doc stubs only when they are markdown/text (NOT history.js from baileys!)
  if (/\.(md|txt)$/i.test(name) && /^(readme|changelog|history|license|authors|contributing)/i.test(name)) {
    return true;
  }
  return false;
}

function copyDir(src, dest, { ignore = [], pruneNm = false } = {}) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignore.includes(entry.name)) continue;
    if (pruneNm && shouldIgnoreNmEntry(entry.name, entry.isDirectory())) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to, { ignore, pruneNm });
    } else {
      copyFile(from, to);
    }
  }
}

function obfuscateJsFile(srcPath, destPath) {
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(code, {
    ...OBFUSCATE_OPTS,
    // Preserve ESM for .js lead-gen scrapers
    ...(srcPath.endsWith('.mjs') || /lead-gen-app/.test(srcPath)
      ? { ignoreImports: true }
      : {}),
  });
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, result.getObfuscatedCode(), 'utf8');
}

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walkJsFiles(full, out);
    } else if (/\.(c?js|mjs)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function protectBulkWhatsApp() {
  const srcRoot = path.join(ROOT, 'bulk-whatsapp', 'frontend');
  const destRoot = path.join(OUT, 'bulk-whatsapp');

  // UI (already minified by Vite)
  copyDir(path.join(srcRoot, 'dist'), path.join(destRoot, 'dist'));

  // Electron host — obfuscate .cjs, copy preload as-is if tiny
  const electronSrc = path.join(srcRoot, 'electron');
  const electronDest = path.join(destRoot, 'electron');
  ensureDir(electronDest);
  for (const file of fs.readdirSync(electronSrc)) {
    const from = path.join(electronSrc, file);
    const to = path.join(electronDest, file);
    if (!fs.statSync(from).isFile()) continue;
    // Keep ALL electron host .cjs plain — obfuscation breaks Baileys requires / IPC
    copyFile(from, to);
    console.log('  copied electron/' + file);
  }

  // Minimal package.json so createRequire(bulkRoot/package.json) works in packaged builds
  fs.writeFileSync(
    path.join(destRoot, 'package.json'),
    JSON.stringify({ name: 'bulk-whatsapp-embed', private: true, version: '6.0.0' }, null, 2),
    'utf8'
  );

  // electron-core: obfuscate source → runtime (same relative layout)
  const coreSrc = path.join(srcRoot, 'electron-core');
  const coreDest = path.join(destRoot, 'electron-core');
  ensureDir(coreDest);

  // index.cjs rewritten to load runtime/ only
  const indexOut = `'use strict';
const path = require('path');
const { createRequire } = require('module');
const CORE_ROOT = __dirname;
const SOURCE_ROOT = path.join(CORE_ROOT, 'runtime');
let runtimeRequire = null;
function getRuntimeRoot() { return SOURCE_ROOT; }
function getRuntimeRequire() {
  if (!runtimeRequire) {
    runtimeRequire = createRequire(path.join(SOURCE_ROOT, 'package.json'));
  }
  return runtimeRequire;
}
function configurePaths(app) {
  const userData = app.getPath('userData');
  process.env.USER_DATA_PATH = process.env.USER_DATA_PATH || userData;
  process.env.LOCAL_MEDIA_GLOBAL_PATH =
    process.env.LOCAL_MEDIA_GLOBAL_PATH || path.join(userData, 'local-media');
  process.env.LOCAL_SESSION_PATH =
    process.env.LOCAL_SESSION_PATH || path.join(userData, 'sessions');
  process.env.LOCAL_MEDIA_PATH =
    process.env.LOCAL_MEDIA_PATH || path.join(userData, 'local-media');
  process.env.LOCAL_MEDIA_LEGACY_PATH =
    process.env.LOCAL_MEDIA_LEGACY_PATH || path.join(userData, 'template-media');
  return { userData, sessionsPath: process.env.LOCAL_SESSION_PATH };
}
module.exports = { CORE_ROOT, SOURCE_ROOT, getRuntimeRoot, getRuntimeRequire, configurePaths };
`;
  fs.writeFileSync(path.join(coreDest, 'index.cjs'), indexOut, 'utf8');
  copyFile(path.join(coreSrc, 'package.json'), path.join(coreDest, 'package.json'));

  // mvc services — keep plain (small; obfuscation not worth breakage risk)
  const mvcSrc = path.join(coreSrc, 'mvc');
  if (fs.existsSync(mvcSrc)) {
    copyDir(mvcSrc, path.join(coreDest, 'mvc'));
    console.log('  copied electron-core/mvc (plain)');
  }

  // source → runtime PLAIN — obfuscation breaks Baileys / dynamic requires
  const sourceDir = path.join(coreSrc, 'source');
  const runtimeDir = path.join(coreDest, 'runtime');
  copyDir(sourceDir, runtimeDir, { ignore: ['node_modules'] });
  console.log('  copied electron-core/runtime (plain)');

  // node_modules (binary deps); prune docs/tests/caches — never prune *.js named history.js etc.
  copyDir(path.join(coreSrc, 'node_modules'), path.join(coreDest, 'node_modules'), {
    ignore: ['.cache', '.bin'],
    pruneNm: true,
  });

  console.log('✓ Bulk WhatsApp protected → build-protected/bulk-whatsapp');
}

function protectLeadGen() {
  const srcRoot = path.join(ROOT, 'lead-gen-app');
  const destRoot = path.join(OUT, 'lead-gen-app');
  ensureDir(destRoot);

  // Slim package.json — production scrape runtime only (no electron / postinstall bloat)
  const pkg = JSON.parse(fs.readFileSync(path.join(srcRoot, 'package.json'), 'utf8'));
  const slimPkg = {
    name: pkg.name,
    version: pkg.version,
    private: true,
    type: 'module',
    dependencies: {
      cheerio: pkg.dependencies.cheerio,
      cors: pkg.dependencies.cors,
      dotenv: pkg.dependencies.dotenv,
      express: pkg.dependencies.express,
      playwright: pkg.dependencies.playwright,
      puppeteer: pkg.dependencies.puppeteer,
      'puppeteer-extra': pkg.dependencies['puppeteer-extra'],
      'puppeteer-extra-plugin-stealth': pkg.dependencies['puppeteer-extra-plugin-stealth'],
    },
  };
  fs.writeFileSync(path.join(destRoot, 'package.json'), JSON.stringify(slimPkg, null, 2), 'utf8');

  // Server + DB can be lightly obfuscated; scrapers MUST stay plain —
  // Playwright page.evaluate() serializes functions; obfuscated outer refs crash in browser.
  for (const rel of ['server.js', 'database.js']) {
    const from = path.join(srcRoot, rel);
    if (!fs.existsSync(from)) {
      console.warn('  missing', rel);
      continue;
    }
    obfuscateJsFile(from, path.join(destRoot, rel));
    console.log('  obfuscated lead-gen/' + rel);
  }
  for (const rel of ['scrapers/justDial.js', 'scrapers/googleMaps.js']) {
    const from = path.join(srcRoot, rel);
    if (!fs.existsSync(from)) {
      console.warn('  missing', rel);
      continue;
    }
    copyFile(from, path.join(destRoot, rel));
    console.log('  copied lead-gen/' + rel + ' (plain — page.evaluate safe)');
  }

  // UI dist
  copyDir(path.join(srcRoot, 'frontend', 'dist'), path.join(destRoot, 'frontend', 'dist'));

  // Runtime node_modules (keep puppeteer/playwright; drop builder tooling + docs)
  const nmSrc = path.join(srcRoot, 'node_modules');
  const nmDest = path.join(destRoot, 'node_modules');
  if (fs.existsSync(nmSrc)) {
    ensureDir(nmDest);
    for (const entry of fs.readdirSync(nmSrc, { withFileTypes: true })) {
      if (NM_SKIP_TOP.has(entry.name)) continue;
      if (entry.name.startsWith('app-builder')) continue;
      if (entry.name.startsWith('builder-util')) continue;
      if (entry.name.startsWith('electron')) continue;
      const from = path.join(nmSrc, entry.name);
      const to = path.join(nmDest, entry.name);
      if (entry.isDirectory()) {
        copyDir(from, to, { pruneNm: true });
      } else if (!shouldIgnoreNmEntry(entry.name, false)) {
        copyFile(from, to);
      }
    }
  }

  // Do NOT copy main.js / database.js / polyfill / README / .env / source frontend
  console.log('✓ Lead Gen protected → build-protected/lead-gen-app');
}

function main() {
  console.log('Protecting embedded apps (obfuscate for release)…');
  rimraf(OUT);
  ensureDir(OUT);
  protectBulkWhatsApp();
  protectLeadGen();
  console.log('Done. Installer will use build-protected/ (no plain source).');
}

main();
