/**
 * Lightweight ad / tracker / redirector blocking for Electron sessions.
 * Blocks known ad networks — does not replace a full browser adblocker,
 * but cuts most popunder / redirect spam on messy sites.
 */

const BLOCKED_HOST_FRAGMENTS = [
  // Ads / trackers
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googletagservices.com',
  'googletagmanager.com',
  'pagead2.googlesyndication',
  'adservice.google',
  'adnxs.com',
  'adsrvr.org',
  'adform.net',
  'advertising.com',
  'adcolony.com',
  'adsafeprotected.com',
  'adsymptotic.com',
  'adtechus.com',
  'advertising.com',
  'amazon-adsystem.com',
  'media.net',
  'outbrain.com',
  'taboola.com',
  'criteo.com',
  'criteo.net',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'quantserve.com',
  'scorecardresearch.com',
  'moatads.com',
  'exelator.com',
  'bluekai.com',
  'bidswitch.net',
  'smartadserver.com',
  'serving-sys.com',
  '2mdn.net',
  'ads-twitter.com',
  'ads.yahoo.com',
  'admob.com',
  'mopub.com',
  'unityads.unity3d.com',
  'applovin.com',
  'inmobi.com',
  'startappz.com',
  'propellerads.com',
  'propellerclick.com',
  'pushengage.com',
  'pushwoosh.com',
  'onesignal.com',
  'perfectaudience.com',
  'revcontent.com',
  'mgid.com',
  'popads.net',
  'popcash.net',
  'popmyads.com',
  'adsterra.com',
  'clickadu.com',
  'hilltopads.com',
  'exoclick.com',
  'juicyads.com',
  'trafficjunky.net',
  'tsyndicate.com',
  'bidvertiser.com',
  'onclickads.net',
  'onclickmega.com',
  'onclicksuper.com',
  'onclkds.com',
  'opienetwork.com',
  'trafficfactory.biz',
  'adk2x.com',
  'adspyglass.com',
  'clickaine.com',
  'clksite.com',
  'realsrv.com',
  'rtmark.net',
  'shorte.st',
  'sh.st',
  'ouo.io',
  'ouo.press',
  'bc.vc',
  'adfly',
  'adf.ly',
  'linkvertise.com',
  'loot-link.com',
  'work.ink',
  'cuty.io',
  'exe.io',
  'fc.lc',
  'gplinks.co',
  'droplink.co',
  'mboost.me',
  'boost.ink',
  'clk.ink',
  'clk.sh',
  // Common redirect / malware junk hosts
  'redirectingat.com',
  's.click.aliexpress',
  'intentmedia.net',
  'betweendigital.com',
  'stickyadstv.com',
  'spotxchange.com',
  'spotx.tv',
  'teads.tv',
  'yieldmo.com',
  'zekeriyafatih.com',
  'histats.com',
  'statcounter.com',
  'mc.yandex.ru',
  'yandex.ru/ads',
  'an.yandex.ru',
];

/** Never block these (messaging / core services). */
const ALLOW_HOST_FRAGMENTS = [
  'whatsapp.com',
  'whatsapp.net',
  'facebook.com',
  'fbcdn.net',
  'fbsbx.com',
  'messenger.com',
  'instagram.com',
  'cdninstagram.com',
  'ig.me',
  'meta.com',
  'telegram.org',
  't.me',
  'discord.com',
  'discordapp.com',
  'discord.gg',
  'google.com',
  'meet.google.com',
  'docs.google.com',
  'drive.google.com',
  'gmail.com',
  'gstatic.com',
  'googleusercontent.com',
  'googleapis.com',
  'office.com',
  'microsoft365.com',
  'officeapps.live.com',
  'live.com',
  'microsoftonline.com',
  'microsoft.com',
  'sharepoint.com',
  'onedrive.com',
  'openai.com',
  'chatgpt.com',
  'anthropic.com',
  'x.com',
  'twitter.com',
  'twimg.com',
  'linkedin.com',
  'github.com',
  'githubusercontent.com',
  'spotify.com',
  'scdn.co',
  'godaddy.com',
  'secureserver.net',
];

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isAllowedHost(host) {
  if (!host) return false;
  return ALLOW_HOST_FRAGMENTS.some((f) => host === f || host.endsWith(`.${f}`) || host.includes(f));
}

export function shouldBlockUrl(url) {
  const host = hostnameOf(url);
  if (!host) return false;
  if (isAllowedHost(host)) return false;
  return BLOCKED_HOST_FRAGMENTS.some((f) => host === f || host.endsWith(`.${f}`) || host.includes(f));
}

const configuredSessions = new WeakSet();

/**
 * Attach network-level ad / redirect blocking to an Electron session.
 */
export function attachAdBlocker(ses) {
  if (!ses || configuredSessions.has(ses)) return;
  configuredSessions.add(ses);

  try {
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      try {
        if (shouldBlockUrl(details.url)) {
          callback({ cancel: true });
          return;
        }
      } catch {
        /* ignore */
      }
      callback({});
    });
  } catch (err) {
    console.warn('Ad blocker attach failed:', err);
  }
}
