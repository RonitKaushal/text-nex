/**
 * Scripts injected into guest messaging webviews for OS notifications.
 * Prefer correct sender + DP; support open-chat-by-name on notification click.
 */

export const MESSAGING_ICON_TYPES = [
  'whatsapp',
  'instagram',
  'snapchat',
  'messenger',
  'facebook',
  'telegram',
  'discord',
  'slack',
  'skype',
  'teams',
  'twitter',
  'gmail',
];

export function buildNotificationBridgeScript(opts: {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  notificationsEnabled: boolean;
}): string {
  const { serviceId, serviceName, serviceType, notificationsEnabled } = opts;
  const sid = JSON.stringify(serviceId);
  const sname = JSON.stringify(serviceName);
  const stype = JSON.stringify(serviceType);
  const enabled = notificationsEnabled ? 'true' : 'false';

  return `
(function() {
  if (window.__textNexusNotifyBridge) return;
  window.__textNexusNotifyBridge = true;
  window.__tnNotificationsEnabled = ${enabled};
  window.__tnLastNotifyAt = 0;
  window.__tnLastNotifyKey = '';

  function api() {
    return window.textNexusNotify || window.electronAPI || null;
  }

  window.__tnAvatarFromImg = function(img) {
    try {
      if (!img) return '';
      var src = img.currentSrc || img.src || '';
      if (!src) return '';
      if (src.indexOf('data:image') === 0) return src;
      var w = img.naturalWidth || img.width || 0;
      var h = img.naturalHeight || img.height || 0;
      if (w < 8 || h < 8) return src.indexOf('http') === 0 ? src : '';
      var size = Math.min(128, Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      if (!ctx) return src.indexOf('http') === 0 ? src : '';
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    } catch (e) {
      var s = (img && (img.currentSrc || img.src)) || '';
      return s.indexOf('http') === 0 || s.indexOf('data:') === 0 ? s : '';
    }
  };

  function normalizeIcon(icon) {
    if (!icon) return '';
    if (typeof icon === 'string') return icon;
    if (typeof icon === 'object' && icon.src) return String(icon.src);
    return '';
  }

  function forward(title, body, icon, chatName) {
    if (window.__tnNotificationsEnabled === false) return Promise.resolve(false);
    var bridge = api();
    if (!bridge || !bridge.showNotification) return Promise.resolve(false);

    var who = (chatName || title || '').trim();
    var key = who + '|' + String(body || '').slice(0, 80);
    var now = Date.now();
    // Short dedupe so rapid successive messages still notify
    if (key && key === window.__tnLastNotifyKey && now - window.__tnLastNotifyAt < 2200) {
      return Promise.resolve(false);
    }
    window.__tnLastNotifyKey = key;
    window.__tnLastNotifyAt = now;

    return bridge.showNotification({
      serviceId: ${sid},
      serviceName: ${sname},
      serviceType: ${stype},
      title: who || 'New message',
      body: body || 'You have a new message',
      icon: normalizeIcon(icon) || '',
      chatName: who || ''
    }).catch(function() { return false; });
  }

  window.__tnForwardNotification = forward;

  window.__tnReportUnread = function(count) {
    var bridge = api();
    if (!bridge || !bridge.reportUnread) return;
    var n = parseInt(count, 10);
    if (isNaN(n) || n < 0) n = 0;
    try {
      bridge.reportUnread({ serviceId: ${sid}, count: n });
    } catch (e) {}
  };

  window.__tnLastInboxKey = '';
  window.__tnSanitizeInboxIcon = function(icon) {
    if (!icon || typeof icon !== 'string') return '';
    if (icon.indexOf('data:') === 0 && icon.length > 4096) return '';
    return icon.slice(0, 8192);
  };
  /** Per-chat unread list for the unified desktop inbox. */
  window.__tnReportUnreadInbox = function(chats) {
    var bridge = api();
    if (!bridge || !bridge.reportUnreadInbox) return;
    var list = Array.isArray(chats) ? chats : [];
    var cleaned = [];
    for (var i = 0; i < list.length && cleaned.length < 40; i++) {
      var c = list[i] || {};
      var name = String(c.name || '').trim();
      var unread = parseInt(c.unread, 10);
      if (!name || !(unread > 0)) continue;
      cleaned.push({
        name: name,
        unread: unread,
        preview: String(c.preview || '').trim().slice(0, 160),
        icon: window.__tnSanitizeInboxIcon(c.icon || '')
      });
    }
    var key = cleaned
      .map(function(c) { return c.name + ':' + c.unread + ':' + c.preview; })
      .join('|');
    if (key === window.__tnLastInboxKey) return;
    window.__tnLastInboxKey = key;
    try {
      bridge.reportUnreadInbox({ serviceId: ${sid}, chats: cleaned });
    } catch (e) {}
  };

  /** Open a chat/DM by contact name (used when user clicks the OS notification). */
  window.__tnOpenChatByName = function(chatName) {
    var target = String(chatName || '').trim().toLowerCase();
    if (!target) return false;

    function rowTitle(row) {
      if (!row) return '';
      var el =
        row.querySelector('[data-testid="cell-frame-title"] span[title]') ||
        row.querySelector('[data-testid="cell-frame-title"] span') ||
        row.querySelector('span[title]') ||
        row.querySelector('[dir="auto"]');
      if (!el) return '';
      return (el.getAttribute('title') || el.textContent || '').trim();
    }

    function clickRow(row) {
      if (!row) return false;
      var clickable =
        row.querySelector('[data-testid="cell-frame-container"]') ||
        row.querySelector('[role="listitem"]') ||
        row;
      try {
        clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        clickable.click();
        return true;
      } catch (e) {
        return false;
      }
    }

    var selectors = [
      '[data-testid="cell-frame-container"]',
      '[data-testid="list-item-"]',
      '#pane-side [role="listitem"]',
      '[role="listitem"]',
      'div[tabindex="0"]'
    ];
    var rows = [];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        if (rows.indexOf(el) === -1) rows.push(el);
      });
    });

    var exact = null;
    var partial = null;
    for (var i = 0; i < rows.length; i++) {
      var name = rowTitle(rows[i]);
      if (!name) continue;
      var lower = name.toLowerCase();
      if (lower === target) {
        exact = rows[i];
        break;
      }
      if (!partial && (lower.indexOf(target) !== -1 || target.indexOf(lower) !== -1)) {
        partial = rows[i];
      }
    }

    if (exact) return clickRow(exact);
    if (partial) return clickRow(partial);

    // Instagram / Messenger: try conversation list links by aria-label / text
    var links = document.querySelectorAll('a[href*="/direct/"], a[href*="/t/"], a[role="link"]');
    for (var j = 0; j < links.length; j++) {
      var label = (links[j].getAttribute('aria-label') || links[j].textContent || '').trim().toLowerCase();
      if (label && (label === target || label.indexOf(target) !== -1)) {
        try { links[j].click(); return true; } catch (e) {}
      }
    }

    // Gmail: click unread thread rows by sender or subject
    var gmailRows = document.querySelectorAll('tr.zA, tr[jsmodel], div[role="row"].zA');
    for (var g = 0; g < gmailRows.length; g++) {
      var grow = gmailRows[g];
      var gText = (grow.getAttribute('aria-label') || grow.textContent || '').trim().toLowerCase();
      var gSender = '';
      var gSub = '';
      var gs =
        grow.querySelector('span.zF') ||
        grow.querySelector('.yW span[email]') ||
        grow.querySelector('.yP') ||
        grow.querySelector('.yW .bA4 span');
      var gj =
        grow.querySelector('.bog') ||
        grow.querySelector('span.bqe') ||
        grow.querySelector('.y6 span');
      if (gs) gSender = (gs.getAttribute('name') || gs.getAttribute('email') || gs.textContent || '').trim().toLowerCase();
      if (gj) gSub = (gj.textContent || '').trim().toLowerCase();
      if (
        (gSender && (gSender === target || gSender.indexOf(target) !== -1 || target.indexOf(gSender) !== -1)) ||
        (gSub && (gSub === target || gSub.indexOf(target) !== -1 || target.indexOf(gSub) !== -1)) ||
        (gText && gText.indexOf(target) !== -1)
      ) {
        try {
          grow.click();
          return true;
        } catch (e) {}
      }
    }
    return false;
  };

  try {
    var NativeNotification = window.Notification;
    function PatchedNotification(title, options) {
      options = options || {};
      var icon = normalizeIcon(options.icon);
      // Native site notification title is usually the real sender
      forward(title, options.body || '', icon, title);
      this.title = title;
      this.body = options.body || '';
      this.icon = icon;
      this.close = function() {};
      this.onclick = null;
    }
    PatchedNotification.permission = 'granted';
    PatchedNotification.requestPermission = function() {
      return Promise.resolve('granted');
    };
    if (NativeNotification) {
      PatchedNotification.prototype = NativeNotification.prototype;
    }
    window.Notification = PatchedNotification;
  } catch (e) {}
})();
`;
}

/** Soft fallback for non-WhatsApp messaging (Instagram / Messenger / Telegram…). */
export function buildTitleWatcherScript(): string {
  return `
(function() {
  if (window.__textNexusTitleWatch) return;
  window.__textNexusTitleWatch = true;

  var lastKey = '';
  var lastSentAt = 0;
  var lastCount = 0;
  var primed = false;

  function pickLatestSender() {
    var unread =
      document.querySelector('[aria-label*="unread" i]') ||
      document.querySelector('[data-testid="icon-unread-count"]') ||
      document.querySelector('[aria-label*="new message" i]');
    if (!unread) return { name: '', icon: '', preview: '' };

    var root =
      unread.closest('[role="listitem"], [role="row"], a, li, article, div') ||
      unread.parentElement;
    if (!root) return { name: '', icon: '', preview: '' };

    var img = root.querySelector('img[src]');
    var nameEl =
      root.querySelector('span[title], [dir="auto"], h2, h3, strong') ||
      root.querySelector('span');
    var name = nameEl
      ? (nameEl.getAttribute('title') || nameEl.textContent || '').trim()
      : '';
    if (/instagram|messenger|telegram|facebook|whatsapp|direct/i.test(name) && name.length < 20) {
      name = '';
    }
    var previewEl =
      root.querySelector('[dir="auto"] span') ||
      root.querySelector('span[dir="auto"]') ||
      null;
    var preview = '';
    if (previewEl && previewEl !== nameEl) {
      preview = (previewEl.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120);
    }
    var icon =
      img && typeof window.__tnAvatarFromImg === 'function'
        ? window.__tnAvatarFromImg(img)
        : (img && (img.currentSrc || img.src)) || '';
    return { name: name, icon: icon, preview: preview };
  }

  function metaFromUnreadEl(el) {
    if (!el) return null;
    var root =
      el.closest('[role="listitem"], [role="row"], a, li, article') ||
      el.closest('div[tabindex]') ||
      el.parentElement;
    if (!root) return null;
    var img = root.querySelector('img[src]');
    var nameEl =
      root.querySelector('span[title], [dir="auto"], h2, h3, strong') ||
      root.querySelector('span');
    var name = nameEl
      ? (nameEl.getAttribute('title') || nameEl.textContent || '').trim()
      : '';
    if (!name) return null;
    if (/instagram|messenger|telegram|facebook|whatsapp|direct|chats?/i.test(name) && name.length < 22) {
      return null;
    }
    var unread = 1;
    var label = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '';
    var m = String(label).match(/(\\d+)/);
    if (m) unread = parseInt(m[1], 10) || 1;
    else {
      var n = parseInt(String(el.textContent || '').replace(/\\D/g, ''), 10);
      if (n > 0) unread = n;
    }
    var previewEl =
      root.querySelector('[dir="auto"] span') ||
      root.querySelector('span[dir="auto"]') ||
      null;
    var preview = '';
    if (previewEl && previewEl !== nameEl) {
      preview = (previewEl.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120);
    }
    var icon =
      img && typeof window.__tnAvatarFromImg === 'function'
        ? window.__tnAvatarFromImg(img)
        : (img && (img.currentSrc || img.src)) || '';
    return { name: name, unread: unread, preview: preview, icon: icon };
  }

  function snapshotSoftInbox() {
    var map = {};
    var nodes = document.querySelectorAll(
      '[aria-label*="unread" i], [data-testid="icon-unread-count"], span[data-testid="icon-unread-count"], [aria-label*="new message" i]'
    );
    for (var i = 0; i < nodes.length; i++) {
      var meta = metaFromUnreadEl(nodes[i]);
      if (!meta || !meta.name) continue;
      if (!map[meta.name] || meta.unread >= map[meta.name].unread) {
        map[meta.name] = meta;
      }
    }
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function extract() {
    var t = document.title || '';
    var countMatch = t.match(/\\((\\d+)\\)/) || t.match(/^(\\d+)\\s*[·•|\\-]/);
    var count = countMatch ? parseInt(countMatch[1], 10) : 0;
    var looksNew = /\\(|•|\\*|new message|messages|unread/i.test(t) || count > 0;
    if (!looksNew) return null;

    var sender = pickLatestSender();
    if (!sender.name) return null;

    return {
      key: sender.name + '|' + (sender.preview || '') + '|' + count,
      title: sender.name,
      body: sender.preview || 'New message',
      icon: sender.icon,
      chatName: sender.name,
      count: count
    };
  }

  function tick() {
    if (window.__tnNotificationsEnabled === false) {
      // Still update badge even if OS toasts are off
    }
    var info = extract();
    var badgeCount = 0;
    if (info && info.count > 0) {
      badgeCount = info.count;
    } else {
      var t = document.title || '';
      var m = t.match(/\\((\\d+)\\)/) || t.match(/^(\\d+)\\s*[·•|\\-]/);
      badgeCount = m ? parseInt(m[1], 10) : 0;
    }
    if (typeof window.__tnReportUnread === 'function') {
      window.__tnReportUnread(badgeCount);
    }

    var softChats = snapshotSoftInbox();
    if (typeof window.__tnReportUnreadInbox === 'function') {
      if (softChats.length > 0) {
        window.__tnReportUnreadInbox(softChats);
      } else if (info && info.chatName && badgeCount > 0) {
        window.__tnReportUnreadInbox([{
          name: info.chatName,
          unread: badgeCount || 1,
          preview: info.body || '',
          icon: info.icon || ''
        }]);
      } else {
        window.__tnReportUnreadInbox([]);
      }
    }

    if (window.__tnNotificationsEnabled === false) return;
    if (!primed) {
      primed = true;
      if (info) {
        lastKey = info.key;
        lastCount = info.count || 0;
      }
      return;
    }
    if (!info) {
      lastCount = 0;
      return;
    }
    // Only when a new message arrives (count up or preview/sender key changed)
    var isNew =
      (info.count > lastCount) ||
      (info.key !== lastKey && info.count > 0);
    if (!isNew) return;

    var now = Date.now();
    if (info.key === lastKey && now - lastSentAt < 2500) return;
    lastKey = info.key;
    lastCount = info.count || lastCount;
    lastSentAt = now;
    if (typeof window.__tnForwardNotification === 'function') {
      window.__tnForwardNotification(info.title, info.body, info.icon, info.chatName);
    }
  }

  setInterval(tick, 1200);
  setTimeout(tick, 2500);
  try {
    var obs = new MutationObserver(function() { setTimeout(tick, 120); });
    obs.observe(document.title ? document.querySelector('title') || document.body : document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } catch (e) {}
})();
`;
}

export function buildWhatsAppWatcherScript(_opts: {
  serviceId: string;
  serviceName: string;
}): string {
  return `
(function() {
  if (window.__textNexusWaWatch) return;
  window.__textNexusWaWatch = true;

  var primed = false;
  var prevByChat = {};
  var lastBadgeTotal = -1;

  function reportInbox(map) {
    if (typeof window.__tnReportUnreadInbox !== 'function') return;
    var chats = Object.keys(map).map(function(k) {
      return map[k];
    });
    window.__tnReportUnreadInbox(chats);
  }

  function chatRowFromBadge(badge) {
    if (!badge) return null;
    return (
      badge.closest('[data-testid="cell-frame-container"]') ||
      badge.closest('[role="listitem"]') ||
      badge.closest('div[tabindex]') ||
      badge.parentElement
    );
  }

  function rowMeta(row) {
    if (!row) return null;
    var img = row.querySelector('img[src]');
    var nameEl =
      row.querySelector('[data-testid="cell-frame-title"] span[title]') ||
      row.querySelector('[data-testid="cell-frame-title"] span') ||
      row.querySelector('span[title]');
    var previewEl =
      row.querySelector('[data-testid="last-msg-status"]') ||
      row.querySelector('[data-testid="cell-frame-secondary"] span') ||
      row.querySelector('[data-testid="cell-frame-secondary"]');
    var badge =
      row.querySelector('[data-testid="icon-unread-count"]') ||
      row.querySelector('span[data-testid="icon-unread-count"]');

    var name = nameEl
      ? (nameEl.getAttribute('title') || nameEl.textContent || '').trim()
      : '';
    if (!name) return null;

    var unread = 0;
    if (badge) {
      unread = parseInt((badge.textContent || '').replace(/\\D/g, ''), 10) || 1;
    }

    var preview = previewEl
      ? (previewEl.getAttribute('title') || previewEl.textContent || '').trim()
      : '';
    preview = preview.replace(/\\s+/g, ' ').slice(0, 120);

    var icon = '';
    if (img && typeof window.__tnAvatarFromImg === 'function') {
      icon = window.__tnAvatarFromImg(img);
    } else if (img) {
      icon = img.currentSrc || img.src || '';
    }

    return { name: name, unread: unread, preview: preview, icon: icon };
  }

  function chatListRoot() {
    return (
      document.querySelector('#pane-side') ||
      document.querySelector('[data-testid="chat-list"]') ||
      document.querySelector('[aria-label="Chat list"]') ||
      null
    );
  }

  function snapshot() {
    var map = {};
    var root = chatListRoot() || document;
    var badges = root.querySelectorAll(
      '[data-testid="icon-unread-count"], span[data-testid="icon-unread-count"]'
    );
    badges.forEach(function(badge) {
      var meta = rowMeta(chatRowFromBadge(badge));
      if (!meta || !meta.name) return;
      if (!map[meta.name] || meta.unread >= map[meta.name].unread) {
        map[meta.name] = meta;
      }
    });
    return map;
  }

  /** Prefer WhatsApp's own nav/tab badge (the green "1" you see) so we match exactly. */
  function nativeNavUnread() {
    var pane = chatListRoot();
    var candidates = document.querySelectorAll(
      '[data-testid="icon-unread-count"], span[data-testid="icon-unread-count"]'
    );
    var foundNavBadge = false;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      // Skip chat-row badges inside the chat list — we want the left-nav Chats badge
      if (pane && pane.contains(el)) continue;
      foundNavBadge = true;
      var n = parseInt((el.textContent || '').replace(/\\D/g, ''), 10);
      if (n > 0) return n;
      return 0;
    }

    // aria-label patterns: "Chats 1 unread", "1 unread message", etc.
    var labeled = document.querySelectorAll(
      '[aria-label*="unread" i], [aria-label*="Unread" i], [title*="unread" i]'
    );
    for (var j = 0; j < labeled.length; j++) {
      var lab = labeled[j];
      if (pane && pane.contains(lab)) continue;
      var text = lab.getAttribute('aria-label') || lab.getAttribute('title') || '';
      var m = text.match(/(\\d+)\\s*unread/i) || text.match(/unread[^0-9]*(\\d+)/i);
      if (m) {
        var v = parseInt(m[1], 10);
        if (v >= 0) return v;
      }
    }

    // If no nav badge element exists, treat as unknown (-1) so fallback can run
    if (foundNavBadge) return 0;
    return -1;
  }

  function totalUnread(map) {
    var native = nativeNavUnread();
    if (native >= 0) return native;

    // Fallback: number of chats with an unread badge (NOT sum of message counts)
    return Object.keys(map).length;
  }

  function notifyChat(cur) {
    var body = cur.preview || 'New message';
    if (typeof window.__tnForwardNotification === 'function') {
      window.__tnForwardNotification(cur.name, body, cur.icon, cur.name);
    }
  }

  function report(total) {
    if (typeof window.__tnReportUnread !== 'function') return;
    if (total === lastBadgeTotal) return;
    lastBadgeTotal = total;
    window.__tnReportUnread(total);
  }

  function tick() {
    var map = snapshot();
    report(totalUnread(map));
    reportInbox(map);

    if (window.__tnNotificationsEnabled === false) {
      prevByChat = map;
      return;
    }

    if (!primed) {
      primed = true;
      prevByChat = map;
      return;
    }

    Object.keys(map).forEach(function(name) {
      var cur = map[name];
      var prev = prevByChat[name];
      var prevUnread = prev ? prev.unread : 0;
      var prevPreview = prev ? prev.preview : '';

      var unreadUp = cur.unread > prevUnread;
      var newPreview =
        !!cur.preview &&
        cur.preview !== prevPreview &&
        cur.unread > 0;

      if (unreadUp || newPreview) {
        notifyChat(cur);
      }
    });

    prevByChat = map;
  }

  // Fast poll so reading a chat drops the badge quickly
  setInterval(tick, 500);
  setTimeout(tick, 800);
  setTimeout(tick, 2000);

  try {
    var pane = chatListRoot() || document.body;
    var obs = new MutationObserver(function() { setTimeout(tick, 40); });
    obs.observe(pane, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title', 'data-testid', 'class']
    });
    // Also watch the left nav (outside chat list) for the green Chats badge
    try {
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e2) {}
  } catch (e) {}
})();
`;
}

/** Gmail inbox — scrape unread threads for the unified desktop inbox. */
export function buildGmailWatcherScript(_opts?: {
  serviceId?: string;
  serviceName?: string;
}): string {
  return `
(function() {
  if (window.__textNexusGmailWatch) return;
  window.__textNexusGmailWatch = true;

  var lastBadge = -1;

  function sanitizeIcon(icon) {
    if (typeof window.__tnSanitizeInboxIcon === 'function') {
      return window.__tnSanitizeInboxIcon(icon);
    }
    if (!icon || typeof icon !== 'string') return '';
    if (icon.indexOf('data:') === 0 && icon.length > 4096) return '';
    return icon.slice(0, 8192);
  }

  function rowIsUnread(row) {
    if (!row) return false;
    var cls = row.getAttribute('class') || '';
    if (cls.indexOf('zE') !== -1) return true;
    if (row.classList && row.classList.contains('zE')) return true;
    var aria = (
      row.getAttribute('aria-label') ||
      row.getAttribute('aria-labelledby') ||
      ''
    ).toLowerCase();
    if (aria.indexOf('unread') !== -1) return true;
    if (row.querySelector('span.zF, .bqe, span.bqe')) return true;
    return false;
  }

  function metaFromRow(row) {
    var senderEl =
      row.querySelector('span.zF') ||
      row.querySelector('.yW span[email]') ||
      row.querySelector('.yP') ||
      row.querySelector('.yW .bA4 span') ||
      row.querySelector('span[email]');
    var subjectEl =
      row.querySelector('.bog') ||
      row.querySelector('span.bqe') ||
      row.querySelector('.y6 .bog') ||
      row.querySelector('.y6 span[id]');
    var snippetEl = row.querySelector('.y2');
    var img = row.querySelector('img[src]');

    var sender = senderEl
      ? (senderEl.getAttribute('name') ||
          senderEl.getAttribute('email') ||
          senderEl.textContent ||
          '').trim()
      : '';
    var subject = subjectEl ? (subjectEl.textContent || '').trim() : '';
    var snippet = snippetEl
      ? (snippetEl.textContent || '').replace(/^\\s*[-–—]\\s*/, '').trim()
      : '';
    if (!sender && !subject) return null;

    var name = sender || subject;
    var preview =
      subject && sender ? subject : snippet || subject || 'Unread email';
    preview = preview.replace(/\\s+/g, ' ').slice(0, 120);

    var icon = '';
    if (img && typeof window.__tnAvatarFromImg === 'function') {
      icon = window.__tnAvatarFromImg(img);
    } else if (img) {
      icon = img.currentSrc || img.src || '';
    }

    return {
      name: name,
      unread: 1,
      preview: preview,
      icon: sanitizeIcon(icon),
      threadKey: (sender || '') + '|' + (subject || name)
    };
  }

  function snapshot() {
    var map = {};
    var rows = document.querySelectorAll(
      'tr.zA, tr[jsmodel].zA, div[role="main"] tr.zA, div[role="row"].zA'
    );
    if (!rows.length) {
      rows = document.querySelectorAll('tr.zA');
    }
    for (var i = 0; i < rows.length && Object.keys(map).length < 40; i++) {
      var row = rows[i];
      if (!rowIsUnread(row)) continue;
      var meta = metaFromRow(row);
      if (!meta) continue;
      if (!map[meta.threadKey]) {
        map[meta.threadKey] = {
          name: meta.name,
          unread: 1,
          preview: meta.preview,
          icon: meta.icon
        };
      }
    }
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function inboxBadgeCount() {
    var links = document.querySelectorAll(
      'a[href*="#inbox"], a[aria-label*="Inbox" i], a[aria-label*="inbox" i]'
    );
    for (var i = 0; i < links.length; i++) {
      var t = links[i].getAttribute('aria-label') || links[i].textContent || '';
      var m = t.match(/inbox[^0-9]*(\\d+)/i) || t.match(/(\\d+)\\s*unread/i);
      if (m) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n >= 0) return n;
      }
    }
    var title = document.title || '';
    var tm = title.match(/Inbox\\s*\\((\\d+)\\)/i) || title.match(/\\((\\d+)\\)/);
    if (tm) return parseInt(tm[1], 10) || 0;
    return -1;
  }

  function tick() {
    var chats = snapshot();
    var badge = inboxBadgeCount();
    if (badge < 0) badge = chats.length;
    if (typeof window.__tnReportUnread === 'function' && badge !== lastBadge) {
      lastBadge = badge;
      window.__tnReportUnread(badge);
    }
    if (typeof window.__tnReportUnreadInbox === 'function') {
      window.__tnReportUnreadInbox(chats);
    }
  }

  setInterval(tick, 1500);
  setTimeout(tick, 1000);
  setTimeout(tick, 3000);
  setTimeout(tick, 6000);
  try {
    var obs = new MutationObserver(function() { setTimeout(tick, 180); });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } catch (e) {}
})();
`;
}

/** Script run from host to open a chat after notification click. */
export function buildOpenChatScript(chatName: string): string {
  const name = JSON.stringify(chatName);
  return `
(function() {
  var name = ${name};
  function tryOpen(attempt) {
    if (typeof window.__tnOpenChatByName === 'function') {
      if (window.__tnOpenChatByName(name)) return true;
    }
    if (attempt < 8) {
      setTimeout(function() { tryOpen(attempt + 1); }, 400 + attempt * 150);
    }
    return false;
  }
  return tryOpen(0);
})();
`;
}
