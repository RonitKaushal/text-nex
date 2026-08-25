/** Parse spoken phrases into TextNexus voice actions. */

export type VoiceAction =
  | { type: 'openWorkspace'; name: string }
  | { type: 'openService'; name: string }
  | { type: 'createWorkspace'; name: string }
  | { type: 'openWorkspaceCreator' }
  | { type: 'openDictation' }
  | { type: 'openAvailableServices' }
  | { type: 'openSettings' }
  | { type: 'openProfile' }
  | { type: 'openSearch'; query: string }
  | { type: 'reload' }
  | { type: 'goBack' }
  | { type: 'dictate'; text: string; send: boolean }
  | { type: 'sendOnly' };

const COMMAND_VERBS =
  /^(open|switch|go|create|type|write|dictate|say|message|send|reload|refresh|search|show|close|available|settings|profile|start)\b/;

/** Common spoken aliases → iconType / catalog id */
export const SERVICE_VOICE_ALIASES: Record<string, string[]> = {
  whatsapp: ['whatsapp', 'whats app', 'what\'s app', 'wa'],
  gmail: ['gmail', 'g mail', 'google mail', 'email'],
  telegram: ['telegram'],
  discord: ['discord'],
  facebook: ['facebook', 'fb'],
  instagram: ['instagram', 'insta'],
  snapchat: ['snapchat', 'snap chat'],
  twitter: ['twitter', 'x', 'twitter x'],
  linkedin: ['linkedin', 'linked in'],
  reddit: ['reddit'],
  github: ['github', 'git hub'],
  'google-calendar': ['google calendar', 'calendar', 'gcal'],
  'google-meet': ['google meet', 'meet'],
  'google-drive': ['google drive', 'drive'],
  'google-docs': ['google docs', 'docs', 'g docs', 'documents'],
  'google-sheets': ['google sheets', 'sheets', 'spreadsheet', 'spreadsheets'],
  'google-slides': ['google slides', 'slides', 'presentation'],
  excel: ['excel', 'excel online', 'microsoft excel'],
  word: ['word', 'word online', 'microsoft word'],
  teams: ['teams', 'microsoft teams', 'ms teams'],
  slack: ['slack'],
  skype: ['skype'],
  zoom: ['zoom'],
  notion: ['notion'],
  trello: ['trello'],
  spotify: ['spotify'],
  youtube: ['youtube', 'you tube'],
  chatgpt: ['chatgpt', 'chat gpt', 'gpt'],
  gemini: ['gemini', 'google gemini'],
  grok: ['grok'],
  messenger: ['messenger', 'fb messenger'],
  'bulk-whatsapp': ['bulk whatsapp', 'bulk wa'],
  'lead-gen': ['lead gen', 'lead generation'],
  'godaddy-email': ['godaddy', 'go daddy email', 'godaddy email'],
};

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    // Common ASR mishearings for "WhatsApp"
    .replace(/\bwhat\s+is\s+(a|the|up|app)\b/g, 'whatsapp')
    .replace(/\bwhats?\s+up\b/g, 'whatsapp')
    .replace(/\bwhats?\s+(happening|it)\b/g, 'whatsapp')
    .replace(/\bwatch\s+some\b/g, 'whatsapp')
    .replace(/\bwhat\s*s\s+app\b/g, 'whatsapp')
    .replace(/\bwhats\s+app\b/g, 'whatsapp')
    .replace(/\bif\s+the\b/g, 'whatsapp')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFiller(s: string): string {
  return normalize(s)
    .replace(/^(please|can you|could you|hey|ok|okay)\s+/i, '')
    .replace(/\s+(please|now|for me)$/i, '')
    .trim();
}

export function looksLikeVoiceCommand(transcript: string): boolean {
  const t = stripFiller(transcript);
  return COMMAND_VERBS.test(t);
}

function matchScore(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q) || q.startsWith(c)) return 90;
  if (c.includes(q) || q.includes(c)) return 75;
  const qw = q.split(' ');
  const cw = new Set(c.split(' '));
  const overlap = qw.filter((w) => cw.has(w)).length;
  if (overlap && overlap === qw.length) return 70;
  if (overlap) return 40 + overlap * 10;
  return 0;
}

export function bestNameMatch(
  spoken: string,
  candidates: Array<{ id: string; name: string; aliases?: string[] }>
): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null;
  for (const c of candidates) {
    const names = [c.name, ...(c.aliases || [])];
    for (const n of names) {
      const score = matchScore(spoken, n);
      if (score >= 60 && (!best || score > best.score)) {
        best = { id: c.id, name: c.name, score };
      }
    }
  }
  return best;
}

export function resolveServiceAlias(spoken: string): string | null {
  const q = normalize(spoken);
  let bestKey: string | null = null;
  let bestScore = 0;
  for (const [key, aliases] of Object.entries(SERVICE_VOICE_ALIASES)) {
    for (const a of [key.replace(/-/g, ' '), ...aliases]) {
      const score = matchScore(q, a);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
  }
  return bestScore >= 60 ? bestKey : null;
}

/**
 * Parse a final transcript into an action.
 * When `preferDictate` is true and no clear command verb, treat as dictation.
 */
export function parseVoiceCommand(
  transcript: string,
  opts?: { preferDictate?: boolean }
): VoiceAction | null {
  const raw = stripFiller(transcript);
  if (!raw) return null;

  // Explicit dictate / type / write with text in the same phrase
  let m =
    raw.match(/^(?:type|write|dictate)\s+(.+)$/i) ||
    raw.match(/^type\s+message\s+(.+)$/i);
  if (m?.[1]) {
    const text = m[1].trim();
    if (text && !/^(please|now|for me|message)$/i.test(text)) {
      return { type: 'dictate', text, send: false };
    }
  }

  // Bare "type" / "write" / "start typing" → next utterance is the message
  if (
    /^(?:type|write|dictate|start\s+typing|start\s+dictating|message\s+mode)$/i.test(
      raw
    )
  ) {
    return { type: 'openDictation' };
  }

  m = raw.match(/^(?:say|message)\s+(.+)$/i);
  if (m?.[1]) {
    const text = m[1].trim();
    if (text && !/^(please|now|for me|mode)$/i.test(text)) {
      return { type: 'dictate', text, send: false };
    }
  }

  // Send …
  m = raw.match(/^send(?:\s+message)?(?:\s+(.+))?$/i);
  if (m) {
    const text = (m[1] || '')
      .trim()
      .replace(/[.…!?]+$/g, '')
      .trim();
    // "send", "send it", "send send send" (Whisper loops) → just press Send
    if (
      !text ||
      /^(it|message|now|please|that)$/i.test(text) ||
      /^(send[\s.,]*)+$/i.test(text)
    ) {
      return { type: 'sendOnly' };
    }
    return { type: 'dictate', text, send: true };
  }

  // Create workspace with name: "create workspace sales"
  m = raw.match(
    /^create(?:\s+a)?\s+workspace(?:\s+(?:named|called|with\s+name|name))?\s+(.+)$/i
  );
  if (m?.[1]) {
    const name = m[1]
      .trim()
      .replace(/[.…!?]+$/g, '')
      .replace(/^(named|called|name)\s+/i, '')
      .trim();
    if (name && !/^(please|now|for me)$/i.test(name)) {
      return { type: 'createWorkspace', name };
    }
  }
  m = raw.match(/^new\s+workspace(?:\s+(?:named|called|name))?\s+(.+)$/i);
  if (m?.[1]) {
    const name = m[1].trim().replace(/[.…!?]+$/g, '').trim();
    if (name) return { type: 'createWorkspace', name };
  }

  // Bare "create workspace" → open creator, next utterance = name
  if (/^(?:create(?:\s+a)?\s+workspace|new\s+workspace)$/i.test(raw)) {
    return { type: 'openWorkspaceCreator' };
  }

  // Open / switch workspace
  m = raw.match(/^(?:open|switch\s+to|go\s+to)\s+workspace\s+(.+)$/i);
  if (m?.[1]) {
    return { type: 'openWorkspace', name: m[1].trim() };
  }

  // Search
  m = raw.match(/^search(?:\s+for)?\s+(.+)$/i);
  if (m?.[1]) {
    return { type: 'openSearch', query: m[1].trim() };
  }

  // Fixed navigation
  if (/^(?:open\s+)?(?:available\s+services|add\s+service|service\s+catalog)$/i.test(raw)) {
    return { type: 'openAvailableServices' };
  }
  if (/^(?:open\s+)?settings$/i.test(raw)) {
    return { type: 'openSettings' };
  }
  if (/^(?:open\s+)?profile$/i.test(raw)) {
    return { type: 'openProfile' };
  }
  if (/^(?:reload|refresh)(?:\s+(?:page|service|tab))?$/i.test(raw)) {
    return { type: 'reload' };
  }
  if (/^(?:go\s+back|show\s+workspaces|close\s+service|back)$/i.test(raw)) {
    return { type: 'goBack' };
  }

  // Open / switch / go to <target>
  m = raw.match(/^(?:open|switch\s+to|go\s+to)\s+(.+)$/i);
  if (m?.[1]) {
    const target = m[1].trim();
    if (/^workspace\b/i.test(target)) {
      return {
        type: 'openWorkspace',
        name: target.replace(/^workspace\s+/i, '').trim(),
      };
    }
    return { type: 'openService', name: target };
  }

  // Bare service name: "whatsapp", "gmail", "google docs"
  // Only when the utterance is essentially the service name (not a chat sentence)
  const alias = resolveServiceAlias(raw);
  if (alias) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length <= 3) {
      return { type: 'openService', name: alias.replace(/-/g, ' ') };
    }
  }

  // Fallback: free speech → dictation when a chat is open
  if (opts?.preferDictate && !looksLikeVoiceCommand(raw)) {
    // Ignore tiny filler so "then," / "hey" don't pollute the compose box
    if (raw.length < 3 || /^(then|hey|um|uh|ah|oh|hmm|yeah|yep|ok|okay)$/i.test(raw)) {
      return null;
    }
    return { type: 'dictate', text: raw, send: false };
  }

  return null;
}
