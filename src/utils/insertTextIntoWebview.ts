/**
 * Inject spoken / reply text into the active guest webview compose box.
 */

export type InsertTextOptions = {
  /** Click Send / press Enter after inserting */
  send?: boolean;
  /** Prefer WhatsApp-specific selectors */
  whatsapp?: boolean;
};

function buildInsertScript(text: string, options: InsertTextOptions): string {
  const payload = JSON.stringify(text);
  const send = options.send ? 'true' : 'false';
  const whatsapp = options.whatsapp ? 'true' : 'false';

  return `
(function() {
  var text = ${payload};
  var shouldSend = ${send};
  var isWhatsApp = ${whatsapp};
  if (!text && !shouldSend) return { ok: false, reason: 'empty' };

  function normalizeMsg(s) {
    return String(s || '')
      .replace(/\\u00a0/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findInput() {
    var selectors = isWhatsApp
      ? [
          '[data-testid="conversation-compose-box-input"]',
          '[contenteditable="true"][data-tab="10"]',
          'footer [contenteditable="true"]',
          'div[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"]'
        ]
      : [
          '[contenteditable="true"]:focus',
          'textarea:focus',
          'input[type="text"]:focus',
          'input:not([type=hidden]):focus',
          '[role="textbox"]',
          '[contenteditable="true"][data-tab="10"]',
          '[data-testid="conversation-compose-box-input"]',
          'footer [contenteditable="true"]',
          'div[contenteditable="true"]',
          'textarea',
          '[placeholder*="message" i]',
          '[placeholder*="Message" i]',
          '[placeholder*="Type" i]'
        ];
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function readValue(el) {
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return (el.innerText || el.textContent || '').replace(/\\u00a0/g, ' ');
    }
    if ('value' in el) return String(el.value || '');
    return '';
  }

  function moveCaretToEnd(el) {
    el.focus();
    try {
      if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else if ('value' in el && typeof el.setSelectionRange === 'function') {
        var len = String(el.value || '').length;
        el.setSelectionRange(len, len);
      }
    } catch (e) {}
  }

  function appendText(el, value) {
    if (!value) return true;
    var current = readValue(el);
    var curN = normalizeMsg(current);
    var valN = normalizeMsg(value);
    // Already typed (e.g. dictate then "send <same text>") — do not insert again
    if (valN && (curN === valN || curN.endsWith(valN))) {
      return true;
    }

    moveCaretToEnd(el);
    var needsSpace =
      current.length > 0 && !/\\s$/.test(current) && value && !/^\\s/.test(value);
    var insert = (needsSpace ? ' ' : '') + value;

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      // One insertion path only. WhatsApp double-types if we execCommand
      // and also dispatch an InputEvent with the same data.
      var ok = false;
      try {
        ok = document.execCommand('insertText', false, insert);
      } catch (e) {
        ok = false;
      }
      if (ok) return true;

      try {
        var dt = new DataTransfer();
        dt.setData('text/plain', insert);
        var paste = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        el.dispatchEvent(paste);
        if (normalizeMsg(readValue(el)).indexOf(valN) !== -1) return true;
      } catch (e2) {}

      el.textContent = current + insert;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    if ('value' in el) {
      el.value = current + insert;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  function clickSend(el) {
    var sendBtn =
      document.querySelector('[data-testid="send"]') ||
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('span[data-testid="send"]') ||
      document.querySelector('button[aria-label*="Send" i]') ||
      document.querySelector('[data-icon="send"]') ||
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('[aria-label="Send"]');
    if (sendBtn) {
      (sendBtn.closest('button') || sendBtn).click();
      return true;
    }
    if (el) {
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
      }));
      el.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
      }));
      return true;
    }
    return false;
  }

  var input = findInput();
  if (!input) return { ok: false, reason: 'no-input' };

  if (text) appendText(input, text);
  if (shouldSend) {
    setTimeout(function() { clickSend(input); }, 100);
  }
  return { ok: true };
})();
`;
}

export async function insertTextIntoWebview(
  webview: { executeJavaScript?: (code: string) => Promise<unknown> } | null | undefined,
  text: string,
  options: InsertTextOptions = {}
): Promise<boolean> {
  if (!webview || typeof webview.executeJavaScript !== 'function') return false;
  try {
    const result = (await webview.executeJavaScript(
      buildInsertScript(text, options)
    )) as { ok?: boolean } | undefined;
    return !!result?.ok;
  } catch {
    return false;
  }
}
