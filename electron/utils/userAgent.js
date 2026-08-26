import { cpus } from 'node:os';
import {
  chromeVersion,
  is64Bit,
  isMac,
  isWindows,
  osArch,
  osRelease,
} from './environment.js';

// Simple Chrome user agent generator
const generateChromeUserAgent = (os, version) => {
  // return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
  return `Mozilla/5.0 (${os}) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/${version} Version/16.0 Safari/605.1.15`;
};

const macOS = () => {
  try {
    // Try to get macOS version from system
    const { execSync } = require('child_process');
    let version = '';
    try {
      version = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
    } catch (error) {
      // Fallback to a common version
      version = '10.15.7';
    }
    
    let cpuName = cpus()[0].model.split(' ')[0];
    if (cpuName.includes('(')) {
      cpuName = cpuName.split('(')[0];
    }
    
    return `Macintosh; ${cpuName} Mac OS X ${version.replaceAll('.', '_')}`;
  } catch (error) {
    // Fallback
    return 'Macintosh; Intel Mac OS X 10_15_7';
  }
};

const windows = () => {
  const version = osRelease;
  const [majorVersion, minorVersion] = version.split('.');
  const archString = is64Bit ? 'Win64; x64' : 'Win32';
  return `Windows NT ${majorVersion}.${minorVersion}; ${archString}`;
};

const linux = () => {
  const archString = is64Bit ? 'x86_64' : osArch;
  return `X11; Linux ${archString}`;
};

export default function userAgent() {
  let platformString;

  if (isMac) {
    platformString = macOS();
  } else if (isWindows) {
    platformString = windows();
  } else {
    platformString = linux();
  }

  return generateChromeUserAgent(platformString, chromeVersion);
}

// Predefined user agents for different services
export const getUserAgentForService = (serviceType = 'default') => {
  const baseUserAgent = userAgent();

  const chromeDesktop = getGoogleChromeIdentity().ua;

  // Snapchat Web is picky — prefer latest Windows Chrome (Onsnap-compatible), no Electron markers
  const snapchatDesktop =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

  const serviceUserAgents = {
    whatsapp: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    gmail: chromeDesktop,
    'google-meet': chromeDesktop,
    'google-calendar': chromeDesktop,
    'google-drive': chromeDesktop,
    'google-docs': chromeDesktop,
    'google-sheets': chromeDesktop,
    'google-slides': chromeDesktop,
    gemini: chromeDesktop,
    excel: chromeDesktop,
    word: chromeDesktop,
    teams: chromeDesktop,
    messenger: chromeDesktop,
    instagram: chromeDesktop,
    facebook: chromeDesktop,
    slack: baseUserAgent,
    snapchat: snapchatDesktop,
    telegram: baseUserAgent,
    discord: baseUserAgent,
    zoom: chromeDesktop,
    default: baseUserAgent,
  };

  return serviceUserAgents[serviceType] || serviceUserAgents.default;
};

/** Clean Chrome UA + client-hint values for Google login (no Electron). */
export function getGoogleChromeIdentity() {
  const full = chromeVersion || '134.0.0.0';
  const major = full.split('.')[0] || '134';
  const platform = isMac ? 'macOS' : isWindows ? 'Windows' : 'Linux';
  const ua = isMac
    ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
    : isWindows
      ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
      : `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
  return {
    ua,
    major,
    secChUa: `"Google Chrome";v="${major}", "Chromium";v="${major}", "Not=A?Brand";v="24"`,
    secChUaPlatform: `"${platform}"`,
  };
}

// WhatsApp specific user agent (most compatible)
export const getWhatsAppUserAgent = () => {
  if (isMac) {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';
  } else if (isWindows) {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  } else {
    return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }
};