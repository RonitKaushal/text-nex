import React from 'react';
import discordIcon from '../assets/discord.png';
import telegramIcon from '../assets/telegram.png';
import godaddyIcon from '../assets/godaddy.png';
import vegamoviesIcon from '../assets/movies/vegamovies.png';
import movies4uIcon from '../assets/movies/movies4u.png';
import hdhub4uIcon from '../assets/movies/hdhub4u.png';
import katmoviehdIcon from '../assets/movies/katmoviehd.png';

import whatsappLogo from '../assets/brands/whatsapp.svg';
import gmailLogo from '../assets/brands/gmail.svg';
import facebookLogo from '../assets/brands/facebook.svg';
import instagramLogo from '../assets/brands/instagram.svg';
import twitterLogo from '../assets/brands/twitter.svg';
import linkedinLogo from '../assets/brands/linkedin.svg';
import redditLogo from '../assets/brands/reddit.svg';
import githubLogo from '../assets/brands/github.svg';
import googleDriveLogo from '../assets/brands/google-drive.svg';
import googleCalendarLogo from '../assets/brands/google-calendar.svg';
import googleMeetLogo from '../assets/brands/google-meet.svg';
import googleDocsLogo from '../assets/brands/google-docs.svg';
import googleSheetsLogo from '../assets/brands/google-sheets.svg';
import googleSlidesLogo from '../assets/brands/google-slides.svg';
import excelLogo from '../assets/brands/excel.svg';
import wordLogo from '../assets/brands/word.svg';
import spotifyLogo from '../assets/brands/spotify.svg';
import slackLogo from '../assets/brands/slack.svg';
import skypeLogo from '../assets/brands/skype.svg';
import teamsLogo from '../assets/brands/teams.svg';
import messengerLogo from '../assets/brands/messenger.svg';
import youtubeLogo from '../assets/brands/youtube.svg';
import tiktokLogo from '../assets/brands/tiktok.svg';
import notionLogo from '../assets/brands/notion.svg';
import trelloLogo from '../assets/brands/trello.svg';
import zoomLogo from '../assets/brands/zoom.svg';
import chatgptLogo from '../assets/brands/chatgpt.svg';
import geminiLogo from '../assets/brands/gemini.svg';
import salesforceLogo from '../assets/brands/salesforce.svg';
import hubspotLogo from '../assets/brands/hubspot.svg';
import ubuntuLogo from '../assets/brands/ubuntu.svg';
import serverLogo from '../assets/brands/server.svg';
import bulkWhatsAppLogo from '../assets/brands/bulk-whatsapp.png';
import snapchatLogo from '../assets/brands/snapchat.svg';
import leadGenLogo from '../assets/brands/lead-gen.png';


import { GlobalOutlined, MessageOutlined } from '@ant-design/icons';

function imgIcon(src, alt) {
  return React.createElement('img', {
    src,
    alt,
    style: {
      width: '20px',
      height: '20px',
      objectFit: 'contain',
      display: 'block',
    },
  });
}

/** Official favicon for any custom service URL. */
export function getFaviconFromUrl(url, size = 128) {
  if (!url) return null;
  try {
    const host = new URL(url.includes('://') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`;
  } catch {
    return null;
  }
}

function entry(logoSrc, color, url, fallbackIcon) {
  return {
    logoSrc,
    icon: logoSrc ? imgIcon(logoSrc, '') : fallbackIcon,
    color,
    url,
  };
}

export const SERVICE_CONFIG = {
  whatsapp: entry(whatsappLogo, '#ffffff', 'https://web.whatsapp.com'),
  gmail: entry(gmailLogo, '#EA4335', 'https://mail.google.com/mail/u/0/'),
  messenger: entry(messengerLogo, '#0084FF', 'https://www.messenger.com'),
  slack: entry(slackLogo, '#4A154B', 'https://slack.com'),
  telegram: entry(telegramIcon, '#0088CC', 'https://web.telegram.org'),
  discord: entry(discordIcon, '#5865F2', 'https://discord.com/app'),
  skype: entry(skypeLogo, '#00AFF0', 'https://web.skype.com'),
  teams: entry(teamsLogo, '#6264A7', 'https://teams.microsoft.com'),
  'godaddy-email': entry(godaddyIcon, '#1B75BB', 'https://email.godaddy.com'),
  vegamovies: entry(vegamoviesIcon, '#E50914', 'https://vegamovies.navy/'),
  movies4u: entry(movies4uIcon, '#FF6B00', 'https://movies4u.ar/'),
  hdhub4u: entry(hdhub4uIcon, '#00B4D8', 'https://hdhub4u.med/'),
  katmoviehd: entry(katmoviehdIcon, '#9B59B6', 'https://new.katmoviehd.top/'),
  custom: entry(null, '#ffffff', 'https://www.google.com', React.createElement(GlobalOutlined, { style: { fontSize: '20px' } })),
  facebook: entry(facebookLogo, '#1877F2', 'https://www.facebook.com'),
  instagram: entry(instagramLogo, '#E1306C', 'https://www.instagram.com'),
  snapchat: entry(snapchatLogo, '#FFFC00', 'https://web.snapchat.com'),
  twitter: entry(twitterLogo, '#1DA1F2', 'https://twitter.com'),
  linkedin: entry(linkedinLogo, '#0A66C2', 'https://www.linkedin.com'),
  github: entry(githubLogo, '#181717', 'https://github.com'),
  'google-calendar': entry(googleCalendarLogo, '#4285F4', 'https://calendar.google.com'),
  'google-meet': entry(googleMeetLogo, '#00897B', 'https://meet.google.com'),
  'google-drive': entry(googleDriveLogo, '#4285F4', 'https://drive.google.com'),
  'google-docs': entry(googleDocsLogo, '#4285F4', 'https://docs.google.com/document/'),
  'google-sheets': entry(googleSheetsLogo, '#0F9D58', 'https://docs.google.com/spreadsheets/'),
  'google-slides': entry(googleSlidesLogo, '#F4B400', 'https://docs.google.com/presentation/'),
  excel: entry(excelLogo, '#217346', 'https://www.office.com/launch/excel'),
  word: entry(wordLogo, '#2B579A', 'https://www.office.com/launch/word'),
  notion: entry(notionLogo, '#000000', 'https://www.notion.so'),
  trello: entry(trelloLogo, '#0079BF', 'https://trello.com'),
  spotify: entry(spotifyLogo, '#1DB954', 'https://open.spotify.com'),
  zoom: entry(zoomLogo, '#2D8CFF', 'https://zoom.us'),
  youtube: entry(youtubeLogo, '#FF0000', 'https://www.youtube.com'),
  tiktok: entry(tiktokLogo, '#000000', 'https://www.tiktok.com'),
  reddit: entry(redditLogo, '#FF4500', 'https://www.reddit.com'),
  salesforce: entry(salesforceLogo, '#00A1E0', 'https://login.salesforce.com'),
  hubspot: entry(hubspotLogo, '#FF7A59', 'https://app.hubspot.com'),
  chatgpt: entry(chatgptLogo, '#00A67E', 'https://chat.openai.com'),
  gemini: entry(geminiLogo, '#4285F4', 'https://gemini.google.com'),
  grok: entry(
    getFaviconFromUrl('https://x.com') || twitterLogo,
    '#FF6B35',
    'https://x.com/i/grok',
  ),
  ubuntu: entry(ubuntuLogo, '#E95420', 'ssh://ubuntu'),
  'ssh-server': entry(serverLogo, '#1a73e8', 'ssh://server'),
  'bulk-whatsapp': entry(bulkWhatsAppLogo, '#0095FF', 'app://bulk-whatsapp'),
  'lead-gen': entry(leadGenLogo, '#F59E0B', 'app://lead-gen'),
};

export const DEFAULT_SERVICE = {
  logoSrc: null,
  icon: React.createElement(MessageOutlined, { style: { fontSize: '20px' } }),
  color: '#ffffff',
  url: 'https://www.google.com',
};

export const getServiceConfig = (iconType) => {
  return SERVICE_CONFIG[iconType] || DEFAULT_SERVICE;
};

/** Resolve official logo image for a service tab (custom > config > url favicon). */
export function getServiceLogoSrc(serviceOrType, url) {
  if (serviceOrType && typeof serviceOrType === 'object') {
    if (serviceOrType.customIcon) return serviceOrType.customIcon;
    const cfg = getServiceConfig(serviceOrType.iconType);
    if (cfg.logoSrc) return cfg.logoSrc;
    return getFaviconFromUrl(serviceOrType.url || cfg.url);
  }
  const cfg = getServiceConfig(serviceOrType);
  if (cfg.logoSrc) return cfg.logoSrc;
  return getFaviconFromUrl(url || cfg.url);
}
