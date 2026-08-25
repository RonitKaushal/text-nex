/**
 * Recognize a short WAV clip.
 * 1) Optional cloud Whisper (GROQ_API_KEY / OPENAI_API_KEY) — accurate
 * 2) Windows Choices (includes common mishearings)
 * 3) Windows dictation + fuzzy map to commands
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapePsSingle(s) {
  return String(s).replace(/'/g, "''");
}

function loadEnvFile() {
  try {
    const root = path.resolve(__dirname, '..', '..');
    const envPath = path.join(root, '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnvFile();

/** Spoken aliases → canonical service name for "open …" */
const SERVICE_ALIASES = {
  whatsapp: ['whatsapp', 'whats app', "what's app", 'wa'],
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
  'google calendar': ['google calendar', 'calendar', 'gcal'],
  'google meet': ['google meet', 'meet', 'google meet call'],
  'google drive': ['google drive', 'drive'],
  'google docs': ['google docs', 'docs', 'g docs', 'documents'],
  'google sheets': ['google sheets', 'sheets', 'spreadsheet', 'spreadsheets'],
  'google slides': ['google slides', 'slides', 'presentation'],
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
  'bulk whatsapp': ['bulk whatsapp', 'bulk wa'],
  'lead gen': ['lead gen', 'lead generation'],
  'godaddy email': ['godaddy', 'go daddy email', 'godaddy email'],
  server: ['server', 'ssh', 'terminal', 'ubuntu', 'ssh server'],
  ubuntu: ['ubuntu'],
  vegamovies: ['vega movies', 'vegamovies'],
  movies4u: ['movies for you', 'movies4u', 'movies 4 u'],
  hdhub4u: ['hd hub', 'hdhub4u'],
  katmoviehd: ['kat movie', 'katmoviehd'],
};

function allServicePhrases() {
  const out = [];
  for (const [canon, aliases] of Object.entries(SERVICE_ALIASES)) {
    out.push(canon, `open ${canon}`, `switch to ${canon}`);
    for (const a of aliases) {
      out.push(a, `open ${a}`, `switch to ${a}`);
    }
  }
  return out;
}

function defaultPhrases() {
  return [
    ...allServicePhrases(),
    'settings',
    'open settings',
    'profile',
    'available services',
    'add service',
    'go back',
    'reload',
    'create workspace',
    'create a workspace',
    'new workspace',
    // WhatsApp mishearings as explicit choices
    'what is a',
    'what is the',
    'what is up',
    "what's up",
  ];
}

function resolveServiceName(spoken) {
  const q = normalizeText(spoken)
    .replace(/^(open|switch to|go to)\s+/, '')
    .trim();
  if (!q) return null;

  let bestKey = null;
  let bestScore = 0;
  for (const [canon, aliases] of Object.entries(SERVICE_ALIASES)) {
    const names = [canon, ...aliases];
    for (const n of names) {
      const nn = normalizeText(n);
      if (!nn) continue;
      let score = 0;
      if (q === nn) score = 100;
      else if (q.length >= 4 && (q.includes(nn) || nn.includes(q))) score = 80;
      else {
        const qw = q.split(' ').filter((w) => w.length > 1);
        const nw = new Set(nn.split(' ').filter((w) => w.length > 1));
        const hit = qw.filter((w) => nw.has(w)).length;
        if (qw.length && hit === qw.length) score = 70;
      }
      if (score > bestScore) {
        bestScore = score;
        bestKey = canon;
      }
    }
  }
  return bestScore >= 70 ? bestKey : null;
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Map ASR output onto a command. Never match ultra-short tokens like "a".
 */
export function fuzzyMatchCommand(heard, phrases) {
  const t = normalizeText(heard);
  if (!t || t.length < 2) return '';

  // Reject pure filler / unrelated chatter
  if (
    /^(a|an|the|i|you|but|and|or|to|of|it|is|in|on|my|me|we|they|that|this|so|yes|no|uh|um|oh|hmm|okay|ok|all of|he had|he did|he made|but|thank you|thanks|do you need it)$/.test(
      t
    )
  ) {
    return '';
  }

  // WhatsApp — Groq often hears: "what's up?", "watch some", "whatsapp."
  if (
    /\bwhats?app\b/.test(t) ||
    /\bwhats\s+app\b/.test(t) ||
    /^whats?\s*up$/.test(t) ||
    /^what\s+is\s+up$/.test(t) ||
    /\bwhat\s+is\s+(a|the|up|app)\b/.test(t) ||
    /^what\s+is\s+(a|the|up)$/.test(t) ||
    /^whats?\s+(happening|it)$/.test(t) ||
    /^watch\s+some$/.test(t) ||
    /^awesome$/.test(t) ||
    /\bwhat\s+sapp\b/.test(t) ||
    /\bwater\s*app\b/.test(t) ||
    /\bwatsapp\b/.test(t) ||
    /^(but\s+)?if\s+the$/.test(t) ||
    /^open\s+whats/.test(t)
  ) {
    return 'whatsapp';
  }

  if (
    /\bg\s*mail\b/.test(t) ||
    /\bgoogle\s+mail\b/.test(t) ||
    t === 'email' ||
    t === 'gmail' ||
    /^open\s+g\s*mail$/.test(t)
  ) {
    return 'gmail';
  }
  if (/\btele\s*gram\b/.test(t) || t === 'telegram' || /^open\s+telegram$/.test(t)) {
    return 'telegram';
  }
  if (/\bdisc\s*ord\b/.test(t) || t === 'discord') return 'discord';
  if (/^(open\s+)?settings$/.test(t)) return 'settings';
  if (/^(go\s+)?back$/.test(t)) return 'go back';
  if (/^(create|new)(\s+a)?\s+workspace/.test(t)) {
    return t; // keep full "create workspace …" for parser
  }
  // Dictation into chat — keep full phrase for the renderer
  if (/^(type|write|dictate|send|say|message)\b/.test(t)) {
    // Whisper often loops "send. send. send." → collapse to send
    if (/^(send[\s.,]*)+$/.test(t)) return 'send';
    return t;
  }
  if (/^start\s+(typing|dictating)$/.test(t)) {
    return t;
  }
  if (/^available\s+services$/.test(t) || /^add\s+service$/.test(t)) {
    return 'available services';
  }
  if (/^(open\s+)?profile$/.test(t)) return 'open profile';
  if (/^(reload|refresh)$/.test(t)) return 'reload';

  // Any known service: "instagram", "open instagram", "google docs", …
  const service = resolveServiceName(t);
  if (service) {
    return `open ${service}`;
  }

  const list = phrases.map(normalizeText).filter((p) => p.length >= 2);
  for (const p of list) {
    if (t === p) return canonicalizePhrase(p);
  }
  // Substring only for meaningful lengths (fixes "a" → whatsapp bug)
  for (const p of list) {
    if (t.length >= 4 && p.length >= 4 && (t.includes(p) || p.includes(t))) {
      return canonicalizePhrase(p);
    }
  }
  const tw = new Set(t.split(' ').filter((w) => w.length > 1));
  let best = '';
  let bestScore = 0;
  for (const p of list) {
    const pw = p.split(' ').filter((w) => w.length > 1);
    if (!pw.length) continue;
    const hit = pw.filter((w) => tw.has(w)).length;
    const score = hit / pw.length;
    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      best = p;
    }
  }
  if (best) {
    const viaService = resolveServiceName(best);
    if (viaService) return `open ${viaService}`;
    return canonicalizePhrase(best);
  }
  return '';
}

function canonicalizePhrase(p) {
  const t = normalizeText(p);
  if (
    /whats?\s*up/.test(t) ||
    /what\s+is\s+(a|the|up)/.test(t) ||
    /whats?\s*app/.test(t) ||
    /watch\s+some/.test(t)
  ) {
    return 'open whatsapp';
  }
  if (/g\s*mail/.test(t)) return 'open gmail';
  const service = resolveServiceName(t);
  if (service) return `open ${service}`;
  return t;
}

function amplifyPcm(pcm) {
  let peak = 1;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  const target = 22000;
  const gain = peak < 500 ? 20 : Math.min(25, target / peak);
  if (gain <= 1.05) return { pcm, peak, gain: 1 };
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.round(pcm[i] * gain);
    out[i] = Math.max(-32768, Math.min(32767, v));
  }
  return { pcm: out, peak, gain };
}

function padSilence(pcm, sampleRate, ms = 250) {
  const n = Math.round((sampleRate * ms) / 1000);
  const out = new Int16Array(pcm.length + n * 2);
  out.set(pcm, n);
  return out;
}

export function buildWavBuffer(int16Array, sampleRate) {
  const samples =
    int16Array instanceof Int16Array ? int16Array : new Int16Array(int16Array);
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buffer;
}

async function whisperTranscribe(wavPath) {
  const groq = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  const key = groq || openai;
  if (!key) return null;

  const isGroq = !!groq;
  const url = isGroq
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';
  const model = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';

  // Bias Whisper toward TextNexus voice commands
  const vocabPrompt =
    'Voice commands: WhatsApp, Gmail, Telegram, type hello, write a message, send thanks, create workspace Sales, available services, open Instagram.';

  try {
    const bytes = fs.readFileSync(wavPath);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'utterance.wav');
    form.append('model', model);
    form.append('language', 'en');
    form.append('temperature', '0');
    form.append('prompt', vocabPrompt);
    form.append('response_format', 'json');

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[voice:wav] whisper HTTP', res.status, body.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text = String(data?.text || '').trim().toLowerCase();
    console.log('[voice:wav] whisper:', text || '(empty)', isGroq ? '(groq)' : '(openai)');
    return text || null;
  } catch (err) {
    console.warn('[voice:wav] whisper failed', err?.message || err);
    return null;
  }
}

function buildRecognizeScript(wavPath, phrases) {
  const list = phrases.map((p) => `'${escapePsSingle(p)}'`).join(',');
  const wav = escapePsSingle(wavPath);
  return `
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech

$installed = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
if ($installed.Count -lt 1) { Write-Output 'ERR:no-recognizer'; exit 1 }

$pick = $null
foreach ($c in @('en-GB', 'en-US', 'en-IN', 'en-AU')) {
  $pick = $installed | Where-Object { $_.Culture.Name -eq $c } | Select-Object -First 1
  if ($null -ne $pick) { break }
}
if ($null -eq $pick) { $pick = $installed[0] }
Write-Output ('CULTURE:' + $pick.Culture.Name)

function Recognize-WithChoices([string]$wave) {
  $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($pick)
  $phraseList = @(${list})
  $choices = New-Object System.Speech.Recognition.Choices
  foreach ($p in $phraseList) { [void]$choices.Add($p) }
  $gb = New-Object System.Speech.Recognition.GrammarBuilder
  $gb.Culture = $recognizer.RecognizerInfo.Culture
  $gb.Append($choices)
  $recognizer.LoadGrammar((New-Object System.Speech.Recognition.Grammar($gb)))
  try { $recognizer.UpdateRecognizerSetting('CFGConfidenceRejectionThreshold', 5) } catch {}
  try { $recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(2) } catch {}
  $recognizer.SetInputToWaveFile($wave)
  $result = $recognizer.Recognize()
  $recognizer.Dispose()
  return $result
}

function Recognize-WithDictation([string]$wave) {
  $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($pick)
  try {
    $gb = New-Object System.Speech.Recognition.GrammarBuilder
    $gb.Culture = $recognizer.RecognizerInfo.Culture
    $gb.AppendDictation()
    $recognizer.LoadGrammar((New-Object System.Speech.Recognition.Grammar($gb)))
  } catch {
    $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  }
  try { $recognizer.UpdateRecognizerSetting('CFGConfidenceRejectionThreshold', 5) } catch {}
  $recognizer.SetInputToWaveFile($wave)
  $result = $recognizer.Recognize()
  $recognizer.Dispose()
  return $result
}

$r1 = Recognize-WithChoices '${wav}'
if ($null -ne $r1 -and -not [string]::IsNullOrWhiteSpace($r1.Text)) {
  $conf = 0
  try { $conf = [math]::Round([double]$r1.Confidence, 2) } catch {}
  Write-Output ('OK:' + $r1.Text.Trim().ToLower())
  Write-Output ('CONF:' + $conf)
  Write-Output 'MODE:choices'
  exit 0
}

$r2 = Recognize-WithDictation '${wav}'
if ($null -ne $r2 -and -not [string]::IsNullOrWhiteSpace($r2.Text)) {
  $conf = 0
  try { $conf = [math]::Round([double]$r2.Confidence, 2) } catch {}
  Write-Output ('DICT:' + $r2.Text.Trim().ToLower())
  Write-Output ('CONF:' + $conf)
  Write-Output 'MODE:dictation'
  exit 0
}

Write-Output 'OK:'
Write-Output 'MODE:none'
`;
}

/**
 * @param {{ pcm: Int16Array|number[]|Buffer, sampleRate: number, phrases?: string[] }} opts
 */
export async function recognizePcmUtterance(opts) {
  loadEnvFile();
  const sampleRate = Number(opts.sampleRate) || 16000;
  const phrases = [
    ...new Set(
      [...defaultPhrases(), ...(Array.isArray(opts.phrases) ? opts.phrases : [])]
        .map((p) => String(p || '').trim().toLowerCase())
        .filter((p) => p.length >= 2 && p.length < 80)
    ),
  ].slice(0, 80);

  let pcm;
  if (Buffer.isBuffer(opts.pcm)) {
    pcm = new Int16Array(
      opts.pcm.buffer,
      opts.pcm.byteOffset,
      Math.floor(opts.pcm.byteLength / 2)
    );
  } else if (opts.pcm instanceof Int16Array) {
    pcm = opts.pcm;
  } else if (Array.isArray(opts.pcm)) {
    pcm = Int16Array.from(opts.pcm);
  } else {
    return { ok: false, text: '', error: 'Invalid PCM data' };
  }

  const durationSec = pcm.length / sampleRate;
  if (durationSec < 0.25) {
    console.log('[voice:wav] skip too-short', durationSec.toFixed(2), 's');
    return { ok: true, text: '', error: 'too-short' };
  }
  // Ignore absurdly long clips (mic stuck open) — SAPI invents junk
  if (durationSec > 8) {
    console.log('[voice:wav] skip too-long', durationSec.toFixed(2), 's');
    return { ok: true, text: '', error: 'too-long' };
  }

  const amp = amplifyPcm(pcm);
  pcm = padSilence(amp.pcm, sampleRate, 300);
  console.log(
    '[voice:wav] clip',
    `${durationSec.toFixed(2)}s`,
    `peak=${amp.peak}`,
    `gain=${amp.gain.toFixed(1)}x`
  );

  const id = `${process.pid}-${Date.now()}`;
  const wavPath = path.join(os.tmpdir(), `textnexus-voice-${id}.wav`);
  const psPath = path.join(os.tmpdir(), `textnexus-voice-${id}.ps1`);

  try {
    fs.writeFileSync(wavPath, buildWavBuffer(pcm, sampleRate));
  } catch (err) {
    return {
      ok: false,
      text: '',
      error: err instanceof Error ? err.message : 'write failed',
    };
  }

  // Cloud Whisper first (needs GROQ_API_KEY or OPENAI_API_KEY in .env)
  const whisperText = await whisperTranscribe(wavPath);
  if (whisperText) {
    const matched = fuzzyMatchCommand(whisperText, phrases);
    try {
      fs.unlinkSync(wavPath);
    } catch {
      /* ignore */
    }
    // Prefer mapped command; otherwise pass raw text so chat dictation works
    const text = matched || whisperText;
    console.log(
      '[voice:wav] recognized:',
      matched || '(dictation)',
      '(whisper)',
      `raw="${whisperText}"`
    );
    return { ok: true, text, raw: whisperText, engine: 'whisper' };
  }

  try {
    fs.writeFileSync(psPath, buildRecognizeScript(wavPath, phrases), 'utf8');
  } catch (err) {
    try {
      fs.unlinkSync(wavPath);
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      text: '',
      error: err instanceof Error ? err.message : 'script write failed',
    };
  }

  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      out += c;
    });
    child.stderr.on('data', (c) => {
      err += c;
    });
    child.on('exit', (code) => {
      try {
        fs.unlinkSync(psPath);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(wavPath);
      } catch {
        /* ignore */
      }

      const lines = out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let text = '';
      let dictRaw = '';
      let confidence;
      let mode = '';
      for (const line of lines) {
        if (line.startsWith('OK:')) text = line.slice(3).trim();
        if (line.startsWith('DICT:')) dictRaw = line.slice(5).trim();
        if (line.startsWith('CONF:')) confidence = Number(line.slice(5));
        if (line.startsWith('MODE:')) mode = line.slice(5).trim();
        if (line.startsWith('CULTURE:')) console.log('[voice:wav]', line);
        if (line.startsWith('ERR:')) {
          resolve({ ok: false, text: '', error: line.slice(4) });
          return;
        }
      }

      const raw = text || dictRaw;
      const matched = raw ? fuzzyMatchCommand(raw, phrases) : '';
      if (raw) {
        console.log(
          '[voice:wav] heard:',
          raw,
          '→',
          matched || '(no command)',
          mode ? `(${mode})` : ''
        );
      }

      if (code && !raw) {
        console.warn('[voice:wav] recognize exit', code, err.trim());
        resolve({
          ok: false,
          text: '',
          error: err.trim() || `exit ${code}`,
        });
        return;
      }

      console.log(
        '[voice:wav] recognized:',
        matched || raw || '(none)',
        mode ? `(${mode})` : '',
        confidence ?? ''
      );
      resolve({
        ok: true,
        text: matched || raw || '',
        confidence,
        raw: raw || undefined,
        engine: 'sapi',
      });
    });
  });
}
