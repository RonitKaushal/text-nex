import React, { useRef, useEffect, useState } from 'react';
import { Alert, Space, Button } from 'antd';
import { storage } from '../utils/storage';
import { ServiceLoadingOverlay } from './common';
import type { ServiceTab } from '../types';
import { getServiceConfig } from '../utils/serviceConfig';
import { useServiceChromeOptional, MAX_BROWSER_TABS } from '../context/ServiceChromeContext';
import { useUnreadOptional } from '../context/UnreadContext';
import {
  MESSAGING_ICON_TYPES,
  buildNotificationBridgeScript,
  buildTitleWatcherScript,
  buildWhatsAppWatcherScript,
  buildGmailWatcherScript,
  buildOpenChatScript,
} from '../utils/notificationInject';
import { onOpenInboxChat } from '../utils/inboxHelpers';

/** Google apps: Chrome UA + stealth preload (contextIsolation off so spoofing hits the page). */
const GOOGLE_WEB_TYPES = new Set([
  'gmail',
  'google-meet',
  'google-calendar',
  'google-drive',
  'google-docs',
  'google-sheets',
  'google-slides',
  'gemini',
]);

/** Microsoft / Zoom workspace apps need a real Chrome UA + lighter page shields. */
const WORKSPACE_WEB_TYPES = new Set([
  'excel',
  'word',
  'teams',
  'zoom',
]);

interface GenericWebViewProps {
  service: ServiceTab;
  isDarkMode: boolean;
  isActive?: boolean;
  notificationsEnabled?: boolean;
}

// Service URLs mapping
const serviceUrls: { [key: string]: string } = {
  whatsapp: 'https://web.whatsapp.com',
  gmail: 'https://mail.google.com',
  messenger: 'https://www.messenger.com',
  slack: 'https://slack.com',
  telegram: 'https://web.telegram.org',
  discord: 'https://discord.com/app',
  skype: 'https://web.skype.com',
  teams: 'https://teams.microsoft.com',
  facebook: 'https://www.facebook.com',
  instagram: 'https://www.instagram.com',
  snapchat: 'https://web.snapchat.com',
  twitter: 'https://twitter.com',
  linkedin: 'https://www.linkedin.com',
  github: 'https://github.com',
  'google-calendar': 'https://calendar.google.com',
  'google-meet': 'https://meet.google.com',
  'google-drive': 'https://drive.google.com',
  'google-docs': 'https://docs.google.com/document/',
  'google-sheets': 'https://docs.google.com/spreadsheets/',
  'google-slides': 'https://docs.google.com/presentation/',
  excel: 'https://www.office.com/launch/excel',
  word: 'https://www.office.com/launch/word',
  notion: 'https://www.notion.so',
  trello: 'https://trello.com',
  spotify: 'https://open.spotify.com',
  zoom: 'https://zoom.us',
  netflix: 'https://www.netflix.com',
  youtube: 'https://www.youtube.com',
  tiktok: 'https://www.tiktok.com',
  reddit: 'https://www.reddit.com',
  'godaddy-email': 'https://email.godaddy.com',
  chatgpt: 'https://chat.openai.com',
  gemini: 'https://gemini.google.com',
  grok: 'https://x.com/i/grok'
};

// Extend the webview element type
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        useragent?: string;
        preload?: string;
        nodeintegration?: string;
        webpreferences?: string;
        allowpopups?: string;
        disablewebsecurity?: string;
      };
    }
  }
}

const GenericWebView: React.FC<GenericWebViewProps> = ({
  service,
  isDarkMode,
  isActive = true,
  notificationsEnabled = true,
}) => {
  const webviewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const [userAgent, setUserAgent] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [webviewPreload, setWebviewPreload] = useState('');
  const [preloadReady, setPreloadReady] = useState(!window.electronAPI);

  const serviceUrl =
    service.url ||
    serviceUrls[service.iconType] ||
    getServiceConfig(service.iconType).url ||
    'https://www.google.com';

  const chrome = useServiceChromeOptional();
  const unreadApi = useUnreadOptional();
  const guestIdRef = useRef<number | null>(null);
  const activeBrowserTabIdRef = useRef(chrome?.activeBrowserTabId || '');
  activeBrowserTabIdRef.current = chrome?.activeBrowserTabId || '';

  // Register this webview + home tab when active
  useEffect(() => {
    if (!chrome || !isActive) return;
    chrome.setWebviewRef(webviewRef);
    chrome.registerServiceHome(service.id, serviceUrl, service.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-register when service/active changes
  }, [isActive, service.id, serviceUrl, service.name]);

  // Listen for Electron events
  useEffect(() => {
    if (window.electronAPI) {
      // Listen for service reload events
      const handleReloadService = (event: any, serviceId: string) => {
        if (serviceId === service.partition) {
          handleReload();
        }
      };

      // Listen for service toggle events
      const handleToggleService = (event: any, serviceId: string, enabled: boolean) => {
        if (serviceId === service.partition) {
          console.log('Service toggled:', serviceId, enabled);
        }
      };

      // Listen for notification toggle events (legacy per-service — sync flag in guest)
      const handleToggleNotifications = (_event: any, serviceId: string, enabled: boolean) => {
        if (serviceId === service.partition || serviceId === service.id) {
          if (webviewRef.current) {
            webviewRef.current
              .executeJavaScript(
                `window.__tnNotificationsEnabled = ${enabled ? 'true' : 'false'};`
              )
              .catch(() => {});
          }
        }
      };

      // Listen for reply events from notifications
      const handleSendReply = (event: any, serviceId: string, replyText: string) => {
        if (serviceId === service.partition && webviewRef.current) {
          console.log('Sending reply to', service.name, ':', replyText);
          
          // Service-specific reply injection
          if (service.iconType === 'whatsapp') {
            // WhatsApp specific reply handling
            webviewRef.current.executeJavaScript(`
              (function() {
                try {
                  const messageInput = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                                     document.querySelector('[contenteditable="true"][data-tab="10"]') ||
                                     document.querySelector('div[contenteditable="true"]');
                  
                  if (messageInput) {
                    messageInput.focus();
                    messageInput.classList.add('reply-highlight');
                    messageInput.innerHTML = '${replyText.replace(/'/g, "\\'")}';
                    
                    const inputEvent = new Event('input', { bubbles: true });
                    messageInput.dispatchEvent(inputEvent);
                    
                    setTimeout(() => {
                      const sendButton = document.querySelector('[data-testid="send"]') ||
                                       document.querySelector('button[aria-label="Send"]') ||
                                       document.querySelector('span[data-testid="send"]');
                      
                      if (sendButton) {
                        sendButton.click();
                        console.log('Reply sent successfully');
                        
                        setTimeout(() => {
                          messageInput.classList.remove('reply-highlight');
                        }, 1000);
                      } else {
                        const enterEvent = new KeyboardEvent('keydown', {
                          key: 'Enter',
                          code: 'Enter',
                          keyCode: 13,
                          which: 13,
                          bubbles: true
                        });
                        messageInput.dispatchEvent(enterEvent);
                        
                        setTimeout(() => {
                          messageInput.classList.remove('reply-highlight');
                        }, 1000);
                      }
                    }, 100);
                  } else {
                    console.log('WhatsApp message input not found');
                  }
                } catch (error) {
                  console.error('Error sending WhatsApp reply:', error);
                }
              })();
            `);
          } else {
            // Generic reply injection for other services
            webviewRef.current.executeJavaScript(`
              (function() {
                try {
                  const inputSelectors = [
                    'input[type="text"]:focus',
                    'textarea:focus',
                    '[contenteditable="true"]:focus',
                    '.message-input',
                    '.compose-input',
                    '[placeholder*="message"]',
                    '[placeholder*="Message"]'
                  ];
                  
                  let messageInput = null;
                  for (const selector of inputSelectors) {
                    messageInput = document.querySelector(selector);
                    if (messageInput) break;
                  }
                  
                  if (messageInput) {
                    messageInput.focus();
                    messageInput.value = '${replyText.replace(/'/g, "\\'")}';
                    
                    const inputEvent = new Event('input', { bubbles: true });
                    messageInput.dispatchEvent(inputEvent);
                    
                    console.log('Reply injected into', '${service.name}');
                  } else {
                    console.log('No suitable input found in', '${service.name}');
                  }
                } catch (error) {
                  console.error('Error injecting reply:', error);
                }
              })();
            `);
          }
        }
      };

      window.electronAPI.onReloadService(handleReloadService);
      window.electronAPI.onToggleService(handleToggleService);
      window.electronAPI.onToggleServiceNotifications(handleToggleNotifications);
      
      if (window.electronAPI.onSendReply) {
        window.electronAPI.onSendReply(handleSendReply);
      }

      return () => {
        // Cleanup listeners if needed
      };
    }
  }, [service.partition]);

  // Load guest preload path (notification bridge — Snapchat uses stealth preload)
  useEffect(() => {
    if (!window.electronAPI?.getWebviewPreloadPath) {
      setPreloadReady(true);
      return;
    }
    void window.electronAPI
      .getWebviewPreloadPath(service.iconType)
      .then((p) => {
        if (typeof p === 'string' && p) setWebviewPreload(p);
        setPreloadReady(true);
      })
      .catch(() => setPreloadReady(true));
  }, [service.iconType]);

  // Keep guest mute flag in sync with global toggle
  useEffect(() => {
    if (!webviewRef.current || !hasInitialized) return;
    webviewRef.current
      .executeJavaScript(
        `window.__tnNotificationsEnabled = ${notificationsEnabled ? 'true' : 'false'};`
      )
      .catch(() => {});
  }, [notificationsEnabled, hasInitialized]);

  // Notification / inbox click → open that contact's DM/chat inside the webview
  useEffect(() => {
    const openChat = (chatName: string) => {
      const webview = webviewRef.current;
      if (!webview || !chatName) return;
      webview
        .executeJavaScript(buildOpenChatScript(chatName))
        .catch(() => {});
    };

    const handleOpen = (data: { serviceId: string; chatName: string }) => {
      if (!data?.chatName) return;
      if (data.serviceId !== service.id && data.serviceId !== service.partition) {
        return;
      }
      const run = () => openChat(data.chatName);
      if (isActive && hasInitialized) {
        setTimeout(run, 200);
        setTimeout(run, 800);
      } else {
        setTimeout(run, 600);
        setTimeout(run, 1400);
      }
    };

    const unsubNotify = window.electronAPI?.onOpenNotificationChat?.(handleOpen);
    const unsubInbox = onOpenInboxChat(handleOpen);

    return () => {
      if (typeof unsubNotify === 'function') unsubNotify();
      unsubInbox();
    };
  }, [service.id, service.partition, isActive, hasInitialized]);

  // Load session data on mount
  useEffect(() => {
    const loadUserAgent = async () => {
      try {
        let ua = '';
        if (service.iconType === 'whatsapp' && window.electronAPI?.getWhatsAppUserAgent) {
          ua = await window.electronAPI.getWhatsAppUserAgent();
        } else if (window.electronAPI?.getUserAgent) {
          ua = await window.electronAPI.getUserAgent(service.iconType);
        } else {
          ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';
        }
        setUserAgent(ua);
        console.log('🔧 User Agent loaded for', service.iconType, ':', ua);
      } catch (error) {
        console.error('❌ Error loading user agent:', error);
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15');
      }
    };
    
    const loadSessionData = async () => {
      try {
        const data = await storage.loadData(`session-${service.partition}`);
        if (data) {
          console.log('📱 Session data loaded for:', service.partition);
        }
      } catch (error) {
        console.error('❌ Error loading session data:', error);
      }
    };
    
    loadUserAgent();
    loadSessionData();
  }, [service.partition, service.iconType]);

  // Save session data periodically
  useEffect(() => {
    const saveSessionData = async () => {
      if (webviewRef.current && webviewReady) {
        try {
          const sessionInfo = {
            partition: service.partition,
            serviceName: service.name,
            serviceType: service.iconType,
            lastAccessed: Date.now(),
            url: serviceUrl
          };
          
          await storage.saveData(`session-${service.partition}`, sessionInfo);
          console.log('💾 Session data saved for:', service.partition);
        } catch (error) {
          console.error('❌ Error saving session data:', error);
        }
      }
    };

    const interval = setInterval(saveSessionData, 30000);
    
    return () => {
      clearInterval(interval);
      saveSessionData();
    };
  }, [service.partition, service.name, service.iconType, serviceUrl, webviewReady]);

  useEffect(() => {
    // Only start timer if this service is active
    if (isActive) {
      const timer = setTimeout(() => {
        if (!webviewReady) {
          setLoading(false);
        }
      }, service.iconType === 'whatsapp' ? 8000 : 
         ['chatgpt', 'gemini', 'grok'].includes(service.iconType) ? 12000 : 10000); // Longer timeout for AI services

      return () => clearTimeout(timer);
    }
  }, [webviewReady, isActive, service.iconType]);

  const handleReload = () => {
    setLoading(true);
    setError(false);
    setWebviewReady(false);
    setHasInitialized(false);
    
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  useEffect(() => {
    // Only initialize webview when it becomes active for the first time
    if (webviewRef.current && isActive && !hasInitialized && userAgent) {
      const webview = webviewRef.current;
      
      console.log('🚀 Initializing webview for:', service.name, 'Type:', service.iconType);
      
      // Set attributes before adding event listeners
      const cleanUa = String(userAgent || '').replace(/\sElectron\/[\d.]+\s*/gi, ' ').trim();
      webview.setAttribute('src', serviceUrl);
      webview.setAttribute('useragent', cleanUa || userAgent);
      webview.setAttribute('partition', `persist:${service.partition}`);
      webview.setAttribute('allowpopups', 'true');
      const isWorkspaceWeb =
        WORKSPACE_WEB_TYPES.has(service.iconType) ||
        GOOGLE_WEB_TYPES.has(service.iconType);
      if (service.iconType === 'snapchat' || GOOGLE_WEB_TYPES.has(service.iconType)) {
        // Isolation off so Chrome spoofing in guest preload is visible to page JS (Google/Snapchat)
        webview.removeAttribute('disablewebsecurity');
        webview.setAttribute(
          'webpreferences',
          'contextIsolation=no,nodeIntegration=no,webSecurity=yes,sandbox=no,backgroundThrottling=yes'
        );
        try {
          if (typeof webview.setUserAgent === 'function') {
            webview.setUserAgent(cleanUa || userAgent);
          }
        } catch {
          /* ignore */
        }
      } else if (isWorkspaceWeb) {
        // Teams / Zoom need secure cookies + real Chrome UA for APIs
        webview.removeAttribute('disablewebsecurity');
        webview.setAttribute(
          'webpreferences',
          'contextIsolation=yes,nodeIntegration=no,webSecurity=yes,sandbox=no,backgroundThrottling=yes'
        );
        try {
          if (typeof webview.setUserAgent === 'function') {
            webview.setUserAgent(cleanUa || userAgent);
          }
        } catch {
          /* ignore */
        }
      } else {
        webview.setAttribute('disablewebsecurity', 'true');
        webview.setAttribute(
          'webpreferences',
          'contextIsolation=false,nodeIntegration=false,webSecurity=false,allowRunningInsecureContent=true'
        );
      }
      
      const handleDomReady = () => {
        console.log('WebView DOM ready for:', service.name);
        setWebviewReady(true);
        setLoading(false);
        setError(false);
        setHasInitialized(true);
        try {
          if (typeof webview.getWebContentsId === 'function') {
            guestIdRef.current = webview.getWebContentsId();
          }
        } catch {
          /* ignore */
        }
        
        // Inject service-specific CSS
        // Full-bleed chat apps need overflow:hidden; websites (Admin Panel, etc.) must scroll
        const isFullBleed =
          MESSAGING_ICON_TYPES.includes(service.iconType) ||
          service.iconType === 'whatsapp';
        let customCSS = isFullBleed
          ? `
          body {
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          
          #app, #root, .app-container {
            height: 100vh !important;
            width: 100vw !important;
          }
          
          .reply-highlight {
            background: #e3f2fd !important;
            border: 2px solid #2196f3 !important;
            border-radius: 8px !important;
          }
        `
          : `
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            height: auto !important;
            min-height: 100% !important;
          }
          
          #app, #root, .app-container {
            height: auto !important;
            min-height: 100% !important;
            width: 100% !important;
            overflow: visible !important;
          }
        `;

        // WhatsApp specific CSS
        if (service.iconType === 'whatsapp') {
          customCSS += `
            #app {
              height: 100vh !important;
              width: 100vw !important;
            }
            
            ._2Ts6i {
              height: 100vh !important;
            }
            
            [data-testid="download-prompt"],
            .download-prompt,
            ._3q4NP {
              display: none !important;
            }
            
            ._2Ts6i ._1jJ70 {
              height: 100vh !important;
            }
          `;
        }

        // Snapchat Web — hide app-download / install banners when possible
        if (service.iconType === 'snapchat') {
          customCSS += `
            [class*="Download"],
            [class*="download"],
            [class*="GetApp"],
            [class*="get-app"],
            [data-testid*="download"],
            a[href*="apps.apple.com"],
            a[href*="play.google.com"] {
              display: none !important;
            }
          `;
        }

        const preserveWindowOpen =
          ['instagram', 'messenger', 'facebook', 'whatsapp', 'discord', 'telegram', 'skype', 'teams', 'google-meet', 'google-calendar', 'zoom', 'snapchat'].includes(service.iconType);
        const isMessaging = MESSAGING_ICON_TYPES.includes(service.iconType);
        const skipAdShield =
          WORKSPACE_WEB_TYPES.has(service.iconType) ||
          GOOGLE_WEB_TYPES.has(service.iconType);

        const adBlockCss = skipAdShield
          ? ''
          : `
          iframe[src*="doubleclick"],
          iframe[src*="googlesyndication"],
          iframe[src*="adnxs"],
          iframe[src*="popads"],
          iframe[src*="propeller"],
          .adsbygoogle,
          [id*="google_ads"],
          [id*="ad-container"],
          [class*="adsbox"],
          [class*="ad-banner"],
          [class*="popup-ad"],
          [id*="popup"],
          [class*="popunder"] {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
            max-height: 0 !important;
            max-width: 0 !important;
            overflow: hidden !important;
          }
        `;

        webview.insertCSS(customCSS + adBlockCss);

        if (!skipAdShield) {
        webview.executeJavaScript(`
          (function() {
            if (window.__textNexusShield) return;
            window.__textNexusShield = true;

            ${preserveWindowOpen ? '' : `
            try {
              window.open = function() { return null; };
            } catch (e) {}
            `}

            ${isMessaging ? '' : `
            try {
              if (window.Notification) {
                Notification.requestPermission = function() {
                  return Promise.resolve('denied');
                };
              }
            } catch (e) {}
            `}

            document.addEventListener('click', function(e) {
              var a = e.target && e.target.closest && e.target.closest('a[target="_blank"]');
              if (a) {
                var href = (a.getAttribute('href') || '').toLowerCase();
                // Don't rewrite call / media links — they need a real popup window
                if (/call|rtc|video|voice|live|rooms|meet\\.google|calendar\\.google|teams\\.microsoft|instagram\\.com|messenger\\.com|facebook\\.com/.test(href)) {
                  return;
                }
                a.setAttribute('target', '_self');
              }
            }, true);

            document.querySelectorAll('meta[http-equiv="refresh"]').forEach(function(m) {
              try { m.remove(); } catch (e) {}
            });

            var killAds = function() {
              if (document.hidden) return;
              document.querySelectorAll(
                'iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adnxs"],iframe[src*="popads"],iframe[src*="propeller"],.adsbygoogle,[id*="google_ads"],[class*="adsbox"]'
              ).forEach(function(el) {
                try { el.remove(); } catch (e) {}
              });
            };
            killAds();
            if (!window.__tnKillAdsTimer) {
              window.__tnKillAdsTimer = setInterval(killAds, 8000);
            }
          })();
        `).catch(function() {});
        }

        // OS notifications + unified unread inbox (WhatsApp / Gmail / other messaging)
        if (isMessaging) {
          const bridge = buildNotificationBridgeScript({
            serviceId: service.id,
            serviceName: service.name,
            serviceType: service.iconType,
            notificationsEnabled,
          });
          webview.executeJavaScript(bridge).catch(() => {});
          if (service.iconType === 'whatsapp') {
            webview
              .executeJavaScript(
                buildWhatsAppWatcherScript({
                  serviceId: service.id,
                  serviceName: service.name,
                })
              )
              .catch(() => {});
          } else if (service.iconType === 'gmail') {
            webview
              .executeJavaScript(
                buildGmailWatcherScript({
                  serviceId: service.id,
                  serviceName: service.name,
                })
              )
              .catch(() => {});
          } else {
            // Instagram / Messenger / etc. — soft unread watcher
            webview.executeJavaScript(buildTitleWatcherScript()).catch(() => {});
          }
        }
      };
      
      const handleDidFailLoad = () => {
        console.log('WebView failed to load:', service.name);
        setLoading(false);
        setError(true);
      };
      
      const handleDidFinishLoad = () => {
        console.log('WebView finished loading:', service.name);
        setLoading(false);
        setError(false);
        if (service.iconType === 'whatsapp') {
          // Redirect to web.whatsapp.com if on wrong page
          setTimeout(() => {
            webview.executeJavaScript(`
              if (document.body.innerHTML.includes('Download WhatsApp') || 
                  document.body.innerHTML.includes('Get WhatsApp Desktop')) {
                window.location.href = 'https://web.whatsapp.com/';
              }
            `);
          }, 2000);
        }
      };
      
      webview.addEventListener('dom-ready', handleDomReady);
      webview.addEventListener('did-fail-load', handleDidFailLoad);
      webview.addEventListener('did-finish-load', handleDidFinishLoad);
      
      return () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('did-fail-load', handleDidFailLoad);
        webview.removeEventListener('did-finish-load', handleDidFinishLoad);
      };
    }
  }, [service.partition, service.id, service.name, service.iconType, serviceUrl, isActive, hasInitialized, userAgent, notificationsEnabled]);

  // Handle visibility changes for performance
  useEffect(() => {
    if (webviewRef.current && hasInitialized) {
      const webview = webviewRef.current;
      
      if (isActive) {
        webview.style.display = 'flex';
        
        setTimeout(() => {
          try {
            webview.focus();
          } catch (error) {
            console.log('Could not focus webview:', error);
          }
        }, 100);
      } else {
        webview.style.display = 'none';
      }
    }
  }, [isActive, hasInitialized]);

  // Sleep: mute audio while the tab is not visible (saves CPU / distraction)
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !hasInitialized) return;
    try {
      if (typeof webview.setAudioMuted === 'function') {
        webview.setAudioMuted(!isActive);
      }
    } catch {
      /* ignore */
    }
  }, [isActive, hasInitialized]);

  // Host-side title unread backup (Telegram/Gmail/etc. put (N) in document.title)
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !hasInitialized || !unreadApi) return;
    const isMessaging = MESSAGING_ICON_TYPES.includes(
      String(service.iconType || '').toLowerCase()
    );
    if (!isMessaging) return;

    // WhatsApp: title often shows message count "(2)" while the green nav badge
    // shows unread chats ("1"). Trust only the DOM watcher for WhatsApp.
    if (service.iconType === 'whatsapp') return;

    const onTitle = (e: { title?: string }) => {
      const title = String(e.title || '');
      const match =
        title.match(/\((\d+)\)/) ||
        title.match(/^(\d+)\s*[·•|\-]/) ||
        title.match(/(\d+)\s+unread/i);
      const count = match ? parseInt(match[1], 10) : 0;
      unreadApi.setUnread(service.id, Number.isFinite(count) ? count : 0);
    };

    webview.addEventListener('page-title-updated', onTitle);
    return () => {
      webview.removeEventListener('page-title-updated', onTitle);
    };
  }, [hasInitialized, unreadApi, service.id, service.iconType]);

  // When leaving a tab, nudge guest to re-report unread (fixes missing sidebar badges)
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !hasInitialized || isActive) return;
    const isMessaging = MESSAGING_ICON_TYPES.includes(
      String(service.iconType || '').toLowerCase()
    );
    if (!isMessaging) return;
    const t = window.setTimeout(() => {
      try {
        // Prefer watcher re-tick if present; never sum per-chat message counts for WhatsApp
        const js =
          service.iconType === 'whatsapp'
            ? `(function(){try{if(typeof window.__tnReportUnread!=='function')return;var pane=document.querySelector('#pane-side')||document.querySelector('[data-testid="chat-list"]');var all=document.querySelectorAll('[data-testid="icon-unread-count"]');var native=-1;for(var i=0;i<all.length;i++){var el=all[i];if(pane&&pane.contains(el))continue;var v=parseInt((el.textContent||'').replace(/\\D/g,''),10);if(v>0){native=v;break;}}if(native>=0){window.__tnReportUnread(native);return;}var chats=0;if(pane){pane.querySelectorAll('[data-testid="icon-unread-count"]').forEach(function(){chats++;});}window.__tnReportUnread(chats);}catch(e){}})();`
            : `(function(){try{if(typeof window.__tnReportUnread!=='function')return;var n=0;var t=document.title||'';var m=t.match(/\\((\\d+)\\)/)||t.match(/^(\\d+)\\s/);if(m)n=parseInt(m[1],10)||0;if(!n){var b=document.querySelectorAll('[data-testid="icon-unread-count"]');b.forEach(function(el){n+=parseInt((el.textContent||'').replace(/\\D/g,''),10)||1;});}window.__tnReportUnread(n);}catch(e){}})();`;
        webview.executeJavaScript(js, false).catch(() => {});
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [isActive, hasInitialized, service.iconType]);

  // Keep tab title / URL in sync with the active webview page
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !hasInitialized) return;

    const onTitle = (e: { title?: string }) => {
      const title = e.title?.trim();
      if (!title || !chrome) return;
      const id = activeBrowserTabIdRef.current;
      chrome.setBrowserTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title } : t))
      );
    };

    const onNavigate = (e: { url?: string }) => {
      const url = e.url;
      if (!url || url === 'about:blank' || !chrome) return;
      const id = activeBrowserTabIdRef.current;
      chrome.setBrowserTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, url } : t))
      );
    };

    webview.addEventListener('page-title-updated', onTitle);
    webview.addEventListener('did-navigate', onNavigate);
    webview.addEventListener('did-navigate-in-page', onNavigate);
    const onStopLoading = () => {
      setLoading(false);
      setError(false);
    };
    webview.addEventListener('did-stop-loading', onStopLoading);
    webview.addEventListener('did-finish-load', onStopLoading);
    return () => {
      webview.removeEventListener('page-title-updated', onTitle);
      webview.removeEventListener('did-navigate', onNavigate);
      webview.removeEventListener('did-navigate-in-page', onNavigate);
      webview.removeEventListener('did-stop-loading', onStopLoading);
      webview.removeEventListener('did-finish-load', onStopLoading);
    };
  }, [hasInitialized]);

  // Links that would open a new Electron window → new in-app tab instead
  useEffect(() => {
    if (!window.electronAPI?.onOpenInAppTab || !chrome) return;
    const unsubscribe = window.electronAPI.onOpenInAppTab((data) => {
      if (!isActive) return;
      if (guestIdRef.current == null || data.guestId !== guestIdRef.current) return;
      if (!data.url) return;

      if (chrome.browserTabs.length >= MAX_BROWSER_TABS) {
        return;
      }

      const id = `tab-${Date.now()}`;
      let title = 'New Tab';
      try {
        title = new URL(data.url).hostname.replace(/^www\./, '') || 'New Tab';
      } catch {
        /* keep default */
      }

      chrome.setBrowserTabs((prev) => {
        if (prev.length >= MAX_BROWSER_TABS) return prev;
        return [...prev, { id, url: data.url, title }];
      });
      chrome.setActiveBrowserTabId(id);
      chrome.setTabBarVisible(true);

      const webview = webviewRef.current;
      if (webview && typeof webview.loadURL === 'function') {
        try {
          webview.loadURL(data.url);
        } catch (err) {
          console.warn('loadURL failed:', err);
        }
      }
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [isActive, chrome]);

  const openInNewTab = () => {
    window.open(serviceUrl, '_blank');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Content */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        background: isDarkMode ? '#000' : '#fff',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {loading && isActive && !hasInitialized && (
          <ServiceLoadingOverlay
            serviceName={service.name}
            iconType={service.iconType}
            customIcon={service.customIcon}
            isDarkMode={isDarkMode}
            url={serviceUrl}
          />
        )}

        {error && isActive && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDarkMode ? '#000' : '#fff',
            zIndex: 1000,
            padding: '20px'
          }}>
            <Alert
              message={`${service.name} Loading Issue`}
              description={
                <div>
                  <p>There was an issue loading {service.name}.</p>
                  <p>Please try reloading or open in a new browser tab.</p>
                </div>
              }
              type="warning"
              showIcon
              action={
                <Space direction="vertical">
                  <Button type="primary" onClick={openInNewTab}>
                    Open in Browser
                  </Button>
                  <Button onClick={handleReload}>
                    Try Again
                  </Button>
                </Space>
              }
            />
          </div>
        )}

        {preloadReady && (
        <webview
          ref={webviewRef}
          src={serviceUrl}
          style={{
            width: '100%',
            height: '100%',
            display: error && isActive ? 'none' : 'flex',
            border: 'none',
            outline: 'none',
            flex: 1,
            // Keep webview painted during first load (under overlay) so navigations work
            visibility: loading && !hasInitialized && isActive ? 'hidden' : 'visible',
          }}
          useragent={userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"}
          partition={`persist:${service.partition}`}
          allowpopups="true"
          {...(webviewPreload ? { preload: webviewPreload } : {})}
          {...(service.iconType === 'snapchat' || GOOGLE_WEB_TYPES.has(service.iconType)
            ? {
                // Isolation off so Chrome spoofing in guest preload is visible to Google's page JS
                webpreferences:
                  'contextIsolation=no,nodeIntegration=no,webSecurity=yes,sandbox=no,backgroundThrottling=yes',
              }
            : WORKSPACE_WEB_TYPES.has(service.iconType)
              ? {
                  webpreferences:
                    'contextIsolation=yes,nodeIntegration=no,webSecurity=yes,sandbox=no,backgroundThrottling=yes',
                }
              : {
                  disablewebsecurity: 'true',
                  webpreferences:
                    'contextIsolation=false,nodeIntegration=false,webSecurity=false,allowRunningInsecureContent=true,backgroundThrottling=yes',
                })}
        />
        )}
      </div>
    </div>
  );
};

export default GenericWebView;
