import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Use the stealth plugin
puppeteer.use(StealthPlugin());

const NUMBER_CODE_MAP = {
  'icon-acb': '0',
  'icon-yz': '1',
  'icon-wx': '2',
  'icon-vu': '3',
  'icon-ts': '4',
  'icon-rq': '5',
  'icon-po': '6',
  'icon-nm': '7',
  'icon-lk': '8',
  'icon-ji': '9',
  'icon-dc': '+',
  'icon-fe': '(',
  'icon-hg': ')',
  'icon-ba': '-',
};

function toTitle(s) {
  return String(s).trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function citySlug(loc) {
  const s = String(loc || 'Mumbai').trim();
  return toTitle(s.split(',')[0].trim()).replace(/\s+/g, '-') || 'Mumbai';
}
function keywordSlug(kw) {
  return toTitle(String(kw || '').trim()).replace(/\s+/g, '-') || 'Services';
}
function normalizePhone(p) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  if (d.length < 10) return null;
  return d;
}

/** Format phone with country code. Default +91 for Indian 10-digit; else detect from digits. */
function formatPhoneWithCountryCode(digits) {
  if (!digits || typeof digits !== 'string') return null;
  const d = digits.replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.length === 10) return '+91' + d;
  if (d.length === 11 && d.startsWith('0')) return '+91' + d.slice(1);
  if (d.length >= 12 && d.startsWith('91')) return '+' + d.slice(0, 12);
  if (d.length > 10) return '+' + d;
  return '+91' + d;
}

const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve, _) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

export async function runJustDialScraper(job, onResult, onProgress) {
  job.results = job.results || [];
  const settings = job.settings || {};
  const maxResults = Math.min(200, Math.max(1, settings.maxResultsPerSearch || 50));
  
  const city = citySlug(job.location);
  const kw = keywordSlug(job.keyword);
  let pageNum = 1;
  const maxPages = Math.ceil(maxResults / 10) + 2;
  const seenPhones = new Set();

  let browser;
  try {
    if (onProgress) onProgress('Launching browser with stealth plugin...');
    browser = await puppeteer.launch({
      headless: true, // "true" uses new headless or old depending on version, fine for this purpose.
      args: ['--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'],
    });

    while (job.results.length < maxResults && pageNum <= maxPages) {
      if (onProgress) onProgress(`Fetching page ${pageNum}...`);
      
      const page = await browser.newPage();
      
      // Navigate to the main listing page
      const pageUrl = `https://www.justdial.com/${city}/${kw}/page-${pageNum}`;
      const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
      
      if (!response) {
        if (pageNum === 1) throw new Error('JustDial fetch failed. Check internet or try another city.');
        await page.close();
        break;
      }
      
      if (onProgress) onProgress(`Scrolling page ${pageNum}...`);
      await autoScroll(page);

      // Extract general listing
      let directory = await page.evaluate((NUMBER_CODE_MAP) => {
        const entries = [];
        const listings = document.querySelectorAll('.cntanr, .resultbox');

        for (const listing of listings) {
          try {
            const nameEl = listing.querySelector('.lng_cont_name, .resultbox_title_anchor');
            const name = nameEl ? nameEl.textContent.trim() : 'Business';
            
            let url = '';
            if (listing.tagName.toLowerCase() === 'a') {
                url = listing.href;
            } else {
                const a = listing.querySelector('a');
                if (a) url = a.href;
            }
            if (url && !url.startsWith('https://')) {
              url = 'https://www.justdial.com' + url;
            }
            
            const phoneSelectors = '.mobilesv, .callcontent, [class*="mobilesv"], [class*="telnowpr"], [class*="icon-"]';
            const phoneNumberArr = Array.from(listing.querySelectorAll(phoneSelectors));
            let phoneNumberRaw = phoneNumberArr.map(n => {
                const cls = (n.className || '').split(/\s+/).find(c => NUMBER_CODE_MAP[c]);
                return cls ? NUMBER_CODE_MAP[cls] : (n.textContent || '').trim();
            }).join('');
            if (!phoneNumberRaw || !/\d/.test(phoneNumberRaw)) {
              const text = listing.textContent || '';
              const match = text.match(/(?:\+91[\s-]*)?(\d[\d\s-]{8,14}\d)/) || text.match(/\b(\d{10})\b/);
              if (match) phoneNumberRaw = match[1].replace(/\s|-/g, '');
            }

            const ratingEl = listing.querySelector('.green-box, .resultbox_totalrate');
            const rating = ratingEl ? ratingEl.textContent.trim() : null;
            
            const votesEl = listing.querySelector('.lng_votes, .resultbox_countvote');
            const votes = votesEl ? votesEl.textContent.trim() : null;

            const addressEl = listing.querySelector('.cont_sw_addr, .resultbox_address');
            const address = addressEl ? addressEl.textContent.trim() : null;

            entries.push({ name, url, phoneNumberRaw, rating, votes, address });
          } catch (e) {
            // Ignore errors for individual rows
          }
        }
        return entries;
      }, NUMBER_CODE_MAP);

      if (!directory || directory.length === 0) {
        if (pageNum === 1) throw new Error('No leads found. Try another keyword/city.');
        await page.close();
        break;
      }

      if (onProgress) onProgress(`Extracting details for ${directory.length} listings using page visits...`);
      
      // Visit each detailed listing individually
      for (let i = 0; i < directory.length; i++) {
        if (job.results.length >= maxResults) break;
        
        const listing = directory[i];
        if (!listing.url || !listing.url.startsWith('http')) continue;

        try {
          await page.goto(listing.url, { timeout: 30000 });
          await page.waitForSelector('body', { timeout: 10000 }).catch(() => null);
          const clicked = await page.evaluate(() => {
            const btn = document.querySelector('a[href*="tel:"], .call_btn, .contact-btn, [class*="show"], [class*="call"]');
            if (btn && /show|number|call|view/i.test(btn.textContent || '')) {
              btn.click();
              return true;
            }
            return false;
          }).catch(() => false);
          if (clicked) await new Promise((r) => setTimeout(r, 800));
          
          const details = await page.evaluate((NUMBER_CODE_MAP) => {
            const getElTxt = (sel) => {
              const el = document.querySelector(sel);
              return el ? el.textContent.trim() : null;
            };
            const getClassesTxt = (claz) => {
              const el = document.getElementsByClassName(claz)[0];
              return el ? el.textContent.trim() : null;
            };
            const decodePhoneFromSpans = (container) => {
              if (!container) return '';
              const spans = container.querySelectorAll('[class*="mobilesv"], [class*="telnowpr"], [class*="icon-"], .tel span, .mobilesv');
              return Array.from(spans).map(n => {
                const cls = (n.className || '').split(/\s+/).find(c => NUMBER_CODE_MAP[c]);
                return cls ? NUMBER_CODE_MAP[cls] : (n.textContent || '').trim();
              }).join('');
            };

            const rating = getClassesTxt('total-rate');
            const votes = getClassesTxt('votes');
            
            const addressWrap = document.getElementById('fulladdress');
            let address = null;
            if (addressWrap) {
               const add = addressWrap.getElementsByClassName('lng_add')[0];
               address = add ? add.textContent.trim() : null;
            }
            
            let detailPhone = '';
            const compContact = document.getElementById('comp-contact') || document.querySelector('.contact-details, .comp-details');
            const dataPhoneEl = document.querySelector('[data-phone], [data-number], [data-mobile], a[href^="tel:"]');
            if (dataPhoneEl) {
              const attr = dataPhoneEl.getAttribute('data-phone') || dataPhoneEl.getAttribute('data-number') || dataPhoneEl.getAttribute('data-mobile');
              const href = dataPhoneEl.getAttribute('href') || '';
              if (attr) detailPhone = attr.replace(/\D/g, '');
              else if (href.startsWith('tel:')) detailPhone = href.replace(/^tel:\s*/, '').replace(/\D/g, '');
            }
            if (!detailPhone && compContact) {
              detailPhone = decodePhoneFromSpans(compContact);
              if (!detailPhone || !/\d{10}/.test(detailPhone)) {
                const raw = compContact.textContent || '';
                const m = raw.match(/(?:\+91[\s-]*)?(\d[\d\s-]{8,14}\d)/) || raw.match(/\b(\d{10})\b/);
                if (m) detailPhone = m[1].replace(/\s|-/g, '');
              }
            }
            
            let website = null;
            const links = document.querySelectorAll('a[href^="http"]');
            for (const a of links) {
              const href = (a.href || '').trim();
              if (!href) continue;
              if (href.includes('justdial.com')) continue;
              const text = (a.textContent || '').toLowerCase();
              if (text.includes('website') || text.includes('visit') || text.includes('www') || /^https?:\/\/[^/]+/.test(href)) {
                website = href;
                break;
              }
            }
            if (!website && compContact) {
              const extLink = compContact.querySelector('a[href^="http"]:not([href*="justdial"])');
              if (extLink) website = extLink.href;
            }
            
            if (typeof removedn === 'function') {
              try { removedn('showmore'); } catch (e) {}
            }
            
            let categories = null;
            const catWrap = document.getElementsByClassName('showmore')[0] || document.querySelector('.jrcat, [class*="categor"], .catg');
            if (catWrap) {
              const categoriesArr = Array.from(catWrap.children).length ? Array.from(catWrap.children) : [catWrap];
              categories = categoriesArr.map((c) => (c.textContent || '').trim()).filter(Boolean).join(', ');
            }
            if (!categories) {
              const catLink = document.querySelector('a[href*="category"], .breadcrumb a');
              if (catLink) categories = catLink.textContent.trim();
            }

            return { rating, votes, address, categories, detailPhone, website };
          }, NUMBER_CODE_MAP);
          
          if (details.rating) listing.rating = details.rating;
          if (details.votes) listing.votes = details.votes;
          if (details.address) listing.address = details.address;
          if (details.categories) listing.categories = details.categories;
          if (details.detailPhone) listing.detailPhone = details.detailPhone;
          if (details.website) listing.website = details.website;
          
        } catch (e) {
          // If we fail to fetch individual page (timeout etc), we just move on using what we have
        }

        let reviewCountNum = null;
        const reviewStr = listing.votes || '';
        const m = reviewStr.match(/(\d+)/);
        if (m) reviewCountNum = parseInt(m[1], 10);
        
        let rawPhone = listing.detailPhone || listing.phoneNumberRaw || '';
        let p = normalizePhone(rawPhone);
        if (!p || p.length < 10) p = null;
        
        if (!p && !listing.url) continue;
        
        const phoneFormatted = p ? formatPhoneWithCountryCode(p) : (rawPhone || null);
        if (p && seenPhones.has(p)) continue;
        if (p) seenPhones.add(p);

        const result = {
          name: listing.name,
          address: listing.address || '',
          phone: phoneFormatted || rawPhone || '',
          website: listing.website || null,
          url: listing.url,
          category: listing.categories || null,
          rating: listing.rating ? parseFloat(listing.rating) : null,
          reviewCount: reviewCountNum
        };
        
        job.results.push(result);
        if (onResult) onResult(result);
        
        if (onProgress) onProgress(`Leads: ${job.results.length}/${maxResults}`);
      }

      await page.close();

      if (directory.length < 5) break; 
      pageNum++;
    }

  } catch (error) {
    if (job.results.length === 0) {
      throw error;
    }
  } finally {
    if (browser) await browser.close();
  }
}
