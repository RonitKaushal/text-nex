import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const dataFields = { businessName: true, category: true, address: true, phoneNumber: true, website: true, rating: true, reviewCount: true };

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--ignore-certificate-errors',
  '--disable-gpu',
  '--disable-dev-shm-usage',
];

function baseLaunchOptions(extra = {}) {
  return {
    headless: true,
    args: LAUNCH_ARGS,
    ...extra,
  };
}

function findSystemChrome() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function findPuppeteerChrome() {
  try {
    const require = createRequire(import.meta.url);
    const puppeteer = require('puppeteer');
    const exe = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : null;
    return exe && fs.existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}

/** Prefer bundled Playwright Chromium; fall back to system Chrome/Edge or Puppeteer Chrome. */
async function launchBrowser() {
  const attempts = [
    () => chromium.launch(baseLaunchOptions()),
    () => chromium.launch(baseLaunchOptions({ channel: 'chrome' })),
    () => chromium.launch(baseLaunchOptions({ channel: 'msedge' })),
  ];
  const exe = findSystemChrome() || findPuppeteerChrome();
  if (exe) {
    attempts.push(() => chromium.launch(baseLaunchOptions({ executablePath: exe })));
  }

  let lastErr;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (!/Executable doesn't exist|browserType\.launch|Failed to launch/i.test(msg)) {
        throw err;
      }
    }
  }
  const hint = 'Run: cd lead-gen-app && npx playwright install chromium';
  throw new Error(`Lead Gen browser missing. ${hint}\n\n${lastErr?.message || lastErr}`);
}

function extractDetailDataInBrowser(fields) {
  const data = {};
  const getCleanText = (el) => (el ? el.textContent.replace(/^[\uE000-\uF8FF]|\u2022/g, '').trim() : null);
  const titleEl = document.querySelector('h1.DUwDvf') || document.querySelector('h1');
  if (titleEl) data.name = titleEl.textContent.trim();
  if (fields.rating || fields.reviewCount) {
    const ratingEl = document.querySelector('div[role="img"][aria-label*="star"]');
    if (ratingEl) {
      const label = ratingEl.getAttribute('aria-label') || '';
      const ratingMatch = label.match(/(\d+\.?\d*)\s*star/i);
      if (ratingMatch) data.rating = parseFloat(ratingMatch[1]);
      const reviewMatch = label.match(/(\d+(?:,\d+)*)\s*review/i);
      if (reviewMatch) data.reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
    }
  }
  const categoryBtn = document.querySelector('button[jsaction*="category"]');
  if (categoryBtn) data.category = categoryBtn.textContent.trim();
  const addressBtn = document.querySelector('button[data-item-id="address"]');
  if (addressBtn) {
    const aria = addressBtn.getAttribute('aria-label');
    data.address = aria && aria.includes('Address:') ? aria.replace('Address:', '').trim() : getCleanText(addressBtn);
  }
  const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
  if (phoneBtn) {
    const aria = phoneBtn.getAttribute('aria-label');
    const phoneText = aria && aria.includes('Phone:') ? aria.replace('Phone:', '').trim() : phoneBtn.textContent.trim();
    const phoneMatch = phoneText.match(/[\d\s\-+()]+/);
    if (phoneMatch) data.phone = phoneMatch[0].trim();
  }
  const websiteLink = document.querySelector('a[data-item-id="authority"]');
  if (websiteLink) data.website = websiteLink.href;
  return data;
}

export async function runGoogleMapsScraper(job, onResult, onProgress) {
  job.results = job.results || [];
  const settings = job.settings || {};
  const maxResults = Math.min(200, Math.max(1, settings.maxResultsPerSearch || 50));
  const existingUrls = job.existingUrls || new Set();

  let browser;
  try {
    if (onProgress) onProgress('Launching browser...');
    browser = await launchBrowser();
    const hasCoords = settings.latitude != null && settings.longitude != null;
    const geo = hasCoords
      ? { latitude: Number(settings.latitude), longitude: Number(settings.longitude) }
      : { longitude: 77.209, latitude: 28.6139 };
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      geolocation: geo,
      permissions: ['geolocation'],
    });
    await context.route('**/*', (route) => {
      const rt = route.request().resourceType();
      if (rt === 'image' || rt === 'font' || rt === 'media') return route.abort();
      route.continue();
    });
    const page = await context.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

    const locationEmpty = !job.location || String(job.location).trim() === '' || /near\s*me/i.test(String(job.location));
    const useNearMe = hasCoords && locationEmpty;
    const query = useNearMe ? String(job.keyword).trim() : `${job.keyword} in ${job.location || 'India'}`;
    const zoom = Math.max(12, Math.min(17, Number(settings.zoomLevel || 15)));
    const searchUrl = useNearMe
      ? `https://www.google.com/maps/search/${encodeURIComponent(String(job.keyword).trim())}/@${geo.latitude},${geo.longitude},${zoom}z?hl=en`
      : `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
    if (onProgress) onProgress('Loading Google Maps...');
    await page.goto('https://www.google.com/maps?hl=en', { waitUntil: 'domcontentloaded' });
    try {
      if (page.url().includes('consent')) await page.click('form button').catch(() => {});
      await page.click('button[aria-label="Accept all"]').catch(() => {});
    } catch (_) {}
    await page.waitForTimeout(1000);
    if (useNearMe) {
      // Bias Maps to current geolocation before searching.
      await page.click('button[aria-label="Current location"]').catch(() => {});
      await page.waitForTimeout(800);
    }
    if (onProgress) onProgress('Searching...');
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.waitForSelector('div[role="feed"]', { timeout: 60000 }).catch(() => {
      throw new Error('Google Maps results not found. Try different keyword/location or use JustDial.');
    });

    const uniqueResults = new Map();
    const feedSelector = 'div[role="feed"]';
    let noNew = 0;
    const maxScrolls = Math.ceil(maxResults / 5) + 5;

    for (let i = 0; i < maxScrolls; i++) {
      if (uniqueResults.size >= maxResults || noNew > 5) break;
      const batch = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('a[href*="/maps/place/"]').forEach((link) => {
          const name = link.getAttribute('aria-label');
          if (name) items.push({ id: link.href, name: name.trim(), url: link.href });
        });
        return items;
      });
      let added = 0;
      for (const item of batch) {
        if (uniqueResults.size >= maxResults) break;
        if (!uniqueResults.has(item.id)) { uniqueResults.set(item.id, item); added++; }
      }
      noNew = added === 0 ? noNew + 1 : 0;
      await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.scrollTop = el.scrollHeight; }, feedSelector);
      await page.waitForTimeout(500);
    }

    const listings = Array.from(uniqueResults.values())
      .filter((l) => !existingUrls.has(l.url))
      .slice(0, maxResults);
    const concurrency = Math.min(2, listings.length);
    const detailPages = [page];
    for (let i = 1; i < concurrency; i++) detailPages.push(await context.newPage());

    for (let start = 0; start < listings.length; start += concurrency) {
      const batch = listings.slice(start, start + concurrency);
      await Promise.all(batch.map((listing, i) => detailPages[i].goto(listing.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null)));
      await page.waitForTimeout(600);
      const details = await Promise.all(batch.map((_, i) => detailPages[i].evaluate(extractDetailDataInBrowser, dataFields).catch(() => null)));
      for (let i = 0; i < batch.length; i++) {
        if (job.results.length >= maxResults) break;
        const fullResult = details[i] ? { ...batch[i], ...details[i], url: batch[i].url } : { name: batch[i].name, url: batch[i].url };
        delete fullResult.id;
        job.results.push(fullResult);
        if (onResult) onResult(fullResult);
      }
      if (onProgress) onProgress(`Leads: ${job.results.length}/${maxResults}`);
      await page.waitForTimeout(200);
    }
    for (let i = 1; i < detailPages.length; i++) await detailPages[i].close().catch(() => {});
  } finally {
    await browser?.close();
  }
}
