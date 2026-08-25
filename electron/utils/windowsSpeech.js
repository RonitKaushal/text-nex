/**
 * Windows speech for TextNexus.
 * Forces the capture device to the user's Bluetooth/headset when possible
 * (e.g. CMF Buds), instead of Steam Streaming Microphone / other defaults.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BrowserWindow } from 'electron';

let proc = null;
let stopping = false;
let scriptPath = null;
let readyTimer = null;
let activePhrases = [];
let restoreMicScript = null;

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(channel, payload);
      } catch {
        /* ignore */
      }
    }
  }
}

function defaultPhrases() {
  return [
    // Prefer Whisper aliases that SAPI often invents
    'whatsapp',
    'whats app',
    "what's app",
    'what is the',
    'what is up',
    'open whatsapp',
    'open whats app',
    "open what's app",
    'gmail',
    'open gmail',
    'telegram',
    'open telegram',
    'discord',
    'open discord',
    'settings',
    'open settings',
    'profile',
    'available services',
    'add service',
    'go back',
    'reload',
    'send message',
    'create workspace',
    'create a workspace',
    'new workspace',
    'google docs',
    'open google docs',
    'google sheets',
    'google sheets',
    'google slides',
    'excel',
    'open excel',
    'open word',
    'microsoft word',
    'teams',
    'open teams',
    'google meet',
    'google calendar',
    'google drive',
  ];
}

function escapePsSingle(s) {
  return String(s).replace(/'/g, "''");
}

/** C# PolicyConfig helper — correct vtable + capture device ID format. */
function policyConfigCSharp() {
  return `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

public static class TnAudioPolicy {
  public enum ERole : uint {
    eConsole = 0,
    eMultimedia = 1,
    eCommunications = 2
  }

  [Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IPolicyConfig {
    [PreserveSig] int GetMixFormat();
    [PreserveSig] int GetDeviceFormat();
    [PreserveSig] int ResetDeviceFormat();
    [PreserveSig] int SetDeviceFormat();
    [PreserveSig] int GetProcessingPeriod();
    [PreserveSig] int SetProcessingPeriod();
    [PreserveSig] int GetShareMode();
    [PreserveSig] int SetShareMode();
    [PreserveSig] int GetPropertyValue();
    [PreserveSig] int SetPropertyValue();
    [PreserveSig] int SetDefaultEndpoint(
      [In, MarshalAs(UnmanagedType.LPWStr)] string deviceId,
      [In, MarshalAs(UnmanagedType.U4)] ERole role);
    [PreserveSig] int SetEndpointVisibility();
  }

  [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
  internal class PolicyConfigClient {}

  // WinRT ids look like: \\\\?\\SWD#MMDEVAPI#{0.0.1.00000000}.{guid}#{...}
  // PolicyConfig wants: {0.0.1.00000000}.{guid}
  public static string NormalizeCaptureId(string raw) {
    if (string.IsNullOrWhiteSpace(raw)) return null;
    var m = Regex.Match(raw, @"(\\{0\\.0\\.1\\.00000000\\}\\.\\{[0-9a-fA-F-]+\\})");
    if (m.Success) return m.Groups[1].Value;
    if (raw.StartsWith("{0.0.1.00000000}.")) return raw;
    // bare guid → capture endpoint
    m = Regex.Match(raw, @"\\{([0-9a-fA-F-]{36})\\}");
    if (m.Success) return "{0.0.1.00000000}.{" + m.Groups[1].Value + "}";
    return raw;
  }

  public static string SetDefaultCapture(string rawDeviceId) {
    string deviceId = NormalizeCaptureId(rawDeviceId);
    if (string.IsNullOrEmpty(deviceId)) return "ERR:bad-id";
    try {
      var cfg = (IPolicyConfig)(new PolicyConfigClient());
      int hr0 = cfg.SetDefaultEndpoint(deviceId, ERole.eConsole);
      int hr1 = cfg.SetDefaultEndpoint(deviceId, ERole.eMultimedia);
      int hr2 = cfg.SetDefaultEndpoint(deviceId, ERole.eCommunications);
      if (hr0 == 0 || hr1 == 0 || hr2 == 0) {
        return "OK:" + deviceId;
      }
      return "ERR:hr=" + hr0 + "," + hr1 + "," + hr2 + " id=" + deviceId;
    } catch (Exception ex) {
      return "ERR:" + ex.GetType().Name + ":" + ex.Message + " id=" + deviceId;
    }
  }
}
"@
`;
}

function buildPrepareMicScript() {
  return `
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${policyConfigCSharp()}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
  $asTaskGeneric = $null
  foreach ($m in [System.WindowsRuntimeSystemExtensions].GetMethods()) {
    if ($m.Name -ne 'AsTask') { continue }
    $params = $m.GetParameters()
    if ($params.Count -eq 1 -and $params[0].ParameterType.Name -eq 'IAsyncOperation\`1') {
      $asTaskGeneric = $m; break
    }
  }
  function Await-WinRT($winRtTask, [Type]$resultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $netTask = $asTask.Invoke($null, @($winRtTask))
    $null = $netTask.Wait(-1)
    return $netTask.Result
  }

  [void][Windows.Media.Devices.MediaDevice,Windows.Media.Devices,ContentType=WindowsRuntime]
  [void][Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]

  $defaultId = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioCaptureId([Windows.Media.Devices.AudioDeviceRole]::Default)
  $commsId = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioCaptureId([Windows.Media.Devices.AudioDeviceRole]::Communications)
  $selector = [Windows.Media.Devices.MediaDevice]::GetAudioCaptureSelector()
  $devices = Await-WinRT ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selector)) ([Windows.Devices.Enumeration.DeviceInformationCollection])

  $preferred = $null
  $preferredName = ''
  $defaultName = ''
  $commsName = ''

  foreach ($d in $devices) {
    if ($d.Id -eq $defaultId) { $defaultName = $d.Name }
    if ($d.Id -eq $commsId) { $commsName = $d.Name }
  }

  # Prefer CMF / Buds / Bluetooth / Hands-Free headset
  foreach ($d in $devices) {
    $n = $d.Name.ToLower()
    if ($n -match 'cmf|buds|airpods|bluetooth|hands-?free|headset') {
      # Skip Steam / virtual / stereo-only output names that aren't capture
      if ($n -match 'steam|vb-audio|cable|stereo mix') { continue }
      $preferred = $d
      break
    }
  }

  # Else use Communications device if different from Steam/default virtual
  if ($null -eq $preferred -and $commsId) {
    foreach ($d in $devices) {
      if ($d.Id -eq $commsId) {
        $n = $d.Name.ToLower()
        if ($n -notmatch 'steam|vb-audio|cable') {
          $preferred = $d
        }
        break
      }
    }
  }

  [Console]::Out.WriteLine(('PREV_DEFAULT_ID:' + $defaultId))
  [Console]::Out.WriteLine(('PREV_DEFAULT_NAME:' + $defaultName))
  [Console]::Out.WriteLine(('COMMS_NAME:' + $commsName))

  if ($null -ne $preferred) {
    $preferredName = $preferred.Name
    [Console]::Out.WriteLine(('PREFERRED_MIC:' + $preferredName))
    [Console]::Out.WriteLine(('PREFERRED_ID:' + $preferred.Id))

    if ($preferred.Id -ne $defaultId) {
      $norm = [TnAudioPolicy]::NormalizeCaptureId($preferred.Id)
      [Console]::Out.WriteLine(('NORMALIZED_ID:' + $norm))
      $ok = [TnAudioPolicy]::SetDefaultCapture($preferred.Id)
      [Console]::Out.WriteLine(('SWITCH_RESULT:' + $ok))
      if ($ok -like 'OK:*') {
        [Console]::Out.WriteLine(('SWITCHED_DEFAULT_TO:' + $preferredName))
        Start-Sleep -Milliseconds 600
        # Verify
        try {
          $nowDefault = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioCaptureId([Windows.Media.Devices.AudioDeviceRole]::Default)
          [Console]::Out.WriteLine(('VERIFY_DEFAULT_ID:' + $nowDefault))
        } catch {}
      } else {
        [Console]::Out.WriteLine(('SWITCH_FAILED:' + $ok))
      }
    } else {
      [Console]::Out.WriteLine(('ALREADY_DEFAULT:' + $preferredName))
    }
  } else {
    [Console]::Out.WriteLine(('PREFERRED_MIC:' + $defaultName))
    [Console]::Out.WriteLine('NO_BT_MIC:1')
  }
} catch {
  [Console]::Out.WriteLine(('MIC_PREPARE_FAIL:' + $_.Exception.Message))
}
`;
}

function buildRestoreMicScript(previousDefaultId) {
  if (!previousDefaultId) return null;
  const id = escapePsSingle(previousDefaultId);
  return `
$ErrorActionPreference = 'Continue'
${policyConfigCSharp()}
try {
  $ok = [TnAudioPolicy]::SetDefaultCapture('${id}')
  [Console]::Out.WriteLine(('RESTORE_RESULT:' + $ok))
  if ($ok -like 'OK:*') { Write-Output 'RESTORED_MIC:1' } else { Write-Output ('RESTORE_FAIL:' + $ok) }
} catch {
  Write-Output ('RESTORE_ERR:' + $_.Exception.Message)
}
`;
}

function winRtAwaitHelpers() {
  // Poll Status/GetResults — AsTask(Invoke) fails on WinRT __ComObject in Windows PowerShell
  return `
function Await-WinRTOp($op) {
  if ($null -eq $op) { throw 'Null WinRT async operation' }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($true) {
    $st = $op.Status
    $name = $st.ToString()
    if ($name -eq 'Completed') {
      return $op.GetResults()
    }
    if ($name -eq 'Error' -or $name -eq 'Canceled') {
      $code = ''
      try { $code = [string]$op.ErrorCode } catch {}
      throw ("WinRT async " + $name + " " + $code)
    }
    if ($sw.Elapsed.TotalSeconds -gt 90) { throw 'WinRT async timeout' }
    Start-Sleep -Milliseconds 40
  }
}
`;
}

/**
 * Windows SpeechRecognizer with default dictation grammar.
 * Empty Constraints + CompileConstraintsAsync loads cloud/online dictation
 * (no Add/Append — PowerShell cannot call those on the WinRT IVector).
 * JS filters transcripts into commands.
 */
function buildWinRtOnlineScript() {
  return `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${winRtAwaitHelpers()}

try {
  [void][Windows.Media.SpeechRecognition.SpeechRecognizer,Windows.Foundation,ContentType=WindowsRuntime]
  [void][Windows.Media.SpeechRecognition.SpeechRecognitionResult,Windows.Foundation,ContentType=WindowsRuntime]
  [void][Windows.Media.SpeechRecognition.SpeechRecognitionResultStatus,Windows.Foundation,ContentType=WindowsRuntime]
  [void][Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime]

  $recognizer = $null
  foreach ($tag in @('en-GB', 'en-US', 'en-IN')) {
    try {
      $cand = [Windows.Globalization.Language]::new($tag)
      $recognizer = [Windows.Media.SpeechRecognition.SpeechRecognizer]::new($cand)
      break
    } catch { $recognizer = $null }
  }
  if ($null -eq $recognizer) {
    $recognizer = [Windows.Media.SpeechRecognition.SpeechRecognizer]::new()
  }
  [Console]::Out.WriteLine(('LANG:' + $recognizer.CurrentLanguage.LanguageTag))
  [Console]::Out.WriteLine(('CONSTRAINTS_COUNT:' + $recognizer.Constraints.Count))
  [Console]::Out.WriteLine('CONSTRAINT:default-dictation (no Add)')

  # Empty constraints → Windows loads default (online) dictation grammar
  $compile = Await-WinRTOp ($recognizer.CompileConstraintsAsync())
  [Console]::Out.WriteLine(('COMPILE:' + $compile.ToString()))
  if ($compile.ToString() -ne 'Success') { throw ('Compile failed: ' + $compile) }

  try { $recognizer.Timeouts.InitialSilenceTimeout = [TimeSpan]::FromSeconds(5) } catch {}
  try { $recognizer.Timeouts.BabbleTimeout = [TimeSpan]::FromSeconds(4) } catch {}
  try { $recognizer.Timeouts.EndSilenceTimeout = [TimeSpan]::FromSeconds(1.1) } catch {}
  try { $recognizer.UIOptions.IsReadBackEnabled = $false } catch {}
  try { $recognizer.UIOptions.ShowConfirmation = $false } catch {}

  [Console]::Out.WriteLine('READY')
  [Console]::Out.WriteLine('ENGINE:winrt-online')
  [Console]::Out.Flush()

  $script:lastText = ''
  $script:lastAt = Get-Date
  $script:idleN = 0
  while ($true) {
    try {
      $result = Await-WinRTOp ($recognizer.RecognizeAsync())
      $status = $result.Status.ToString()
      if ($status -eq 'Success' -and -not [string]::IsNullOrWhiteSpace($result.Text)) {
        $confName = $result.Confidence.ToString()
        if ($confName -eq 'Low') {
          [Console]::Out.WriteLine(('REJECT:low ' + $result.Text.Trim().ToLower()))
          [Console]::Out.Flush()
          continue
        }
        $text = $result.Text.Trim().ToLower()
        $now = Get-Date
        $elapsed = ($now - $script:lastAt).TotalSeconds
        if ($text -ne $script:lastText -or $elapsed -ge 0.9) {
          $script:lastText = $text
          $script:lastAt = $now
          $script:idleN = 0
          [Console]::Out.WriteLine(('RESULT:' + $text))
          [Console]::Out.WriteLine(('CONF:' + $confName))
          [Console]::Out.Flush()
        }
      } else {
        $script:idleN++
        [Console]::Out.WriteLine(('IDLE:' + $script:idleN + ' status=' + $status))
        [Console]::Out.Flush()
      }
    } catch {
      [Console]::Error.WriteLine(('RECOG_ERR:' + $_.Exception.Message))
      Start-Sleep -Milliseconds 500
    }
  }
} catch {
  [Console]::Error.WriteLine(('WINRT_FAIL:' + $_.Exception.Message))
  exit 4
}
`;
}

/** Offline SAPI fallback — free dictation (hears Bluetooth); JS filters commands. */
function buildSapiScript(_phrases) {
  return `
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech

$installed = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
if ($installed.Count -lt 1) {
  [Console]::Error.WriteLine('NO_RECOGNIZER_INSTALLED')
  exit 3
}
[Console]::Out.WriteLine(('INSTALLED:' + (($installed | ForEach-Object { $_.Culture.Name }) -join ',')))

$pick = $null
foreach ($c in @('en-GB', 'en-US', 'en-IN', 'en-AU')) {
  $pick = $installed | Where-Object { $_.Culture.Name -eq $c } | Select-Object -First 1
  if ($null -ne $pick) { break }
}
if ($null -eq $pick) { $pick = $installed[0] }

try {
  $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($pick)
  [Console]::Error.WriteLine(('CULTURE:' + $pick.Culture.Name))
} catch {
  [Console]::Error.WriteLine(('ENGINE_CREATE_FAIL:' + $_.Exception.Message))
  exit 3
}

try {
  $recognizer.SetInputToDefaultAudioDevice()
  [Console]::Out.WriteLine('SAPI_INPUT:default-audio-device')
} catch {
  [Console]::Error.WriteLine(('NO_MIC:' + $_.Exception.Message))
  exit 2
}

# Free dictation hears CMF/Bluetooth; constrained phrases alone often stay IDLE
try {
  $gb = New-Object System.Speech.Recognition.GrammarBuilder
  $gb.Culture = $recognizer.RecognizerInfo.Culture
  $gb.AppendDictation()
  $recognizer.LoadGrammar((New-Object System.Speech.Recognition.Grammar($gb)))
  [Console]::Out.WriteLine('DICTATION:append-ok')
} catch {
  try {
    $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    [Console]::Out.WriteLine('DICTATION:class-ok')
  } catch {
    [Console]::Error.WriteLine(('DICTATION_FAIL:' + $_.Exception.Message))
    exit 3
  }
}

try { $recognizer.UpdateRecognizerSetting('CFGConfidenceRejectionThreshold', 25) } catch {}
try { $recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(4) } catch {}
try { $recognizer.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(800) } catch {}

[Console]::Out.WriteLine('READY')
[Console]::Out.WriteLine('ENGINE:sapi-dictation')
[Console]::Out.Flush()

$script:lastText = ''
$script:lastAt = Get-Date
$script:idleN = 0
while ($true) {
  try {
    $result = $recognizer.Recognize([TimeSpan]::FromSeconds(4))
    if ($null -ne $result -and -not [string]::IsNullOrWhiteSpace($result.Text)) {
      $text = $result.Text.Trim().ToLower()
      $conf = 0
      try { $conf = [math]::Round([double]$result.Confidence, 2) } catch {}
      if ($conf -gt 0 -and $conf -lt 0.45) {
        [Console]::Out.WriteLine(('REJECT:low ' + $text + ' conf=' + $conf))
        [Console]::Out.Flush()
        continue
      }
      $now = Get-Date
      $elapsed = ($now - $script:lastAt).TotalSeconds
      if ($text -ne $script:lastText -or $elapsed -ge 0.9) {
        $script:lastText = $text
        $script:lastAt = $now
        $script:idleN = 0
        [Console]::Out.WriteLine(('RESULT:' + $text))
        [Console]::Out.WriteLine(('CONF:' + $conf))
        [Console]::Out.Flush()
      }
    } else {
      $script:idleN++
      [Console]::Out.WriteLine(('IDLE:' + $script:idleN))
      [Console]::Out.Flush()
    }
  } catch {
    Start-Sleep -Milliseconds 200
  }
}
`;
}

function runPsFile(script, onLine, onDone) {
  const file = path.join(
    os.tmpdir(),
    `textnexus-voice-step-${process.pid}-${Date.now()}.ps1`
  );
  fs.writeFileSync(file, script, 'utf8');
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (c) => {
    buf += c;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (t) onLine?.(t);
    }
  });
  child.stderr.on('data', (c) => {
    console.warn('[voice:err]', String(c).trim());
  });
  child.on('exit', () => {
    if (buf.trim()) onLine?.(buf.trim());
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
    onDone?.();
  });
  return child;
}

export function isWindowsSpeechAvailable() {
  return process.platform === 'win32';
}

function restorePreviousMic() {
  if (!restoreMicScript) return;
  const script = restoreMicScript;
  restoreMicScript = null;
  console.log('[voice] restoring previous default microphone');
  runPsFile(
    script,
    (line) => console.log('[voice]', line),
    () => {}
  );
}

export function stopWindowsSpeech() {
  stopping = true;
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
  const p = proc;
  proc = null;
  if (p) {
    try {
      p.kill();
    } catch {
      /* ignore */
    }
    try {
      if (p.pid) {
        spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      }
    } catch {
      /* ignore */
    }
  }
  if (scriptPath) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
    scriptPath = null;
  }
  restorePreviousMic();
}

function normalizeVoiceText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\bwhat\s*s\s+app\b/g, 'whatsapp')
    .replace(/\bwhats\s+app\b/g, 'whatsapp')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop SAPI/ambient hallucinations like "the", "but", "whether". */
function isUsefulVoiceTranscript(text) {
  const t = normalizeVoiceText(text);
  if (!t || t.length < 3) return false;

  const fillers = new Set([
    'the',
    'a',
    'an',
    'i',
    'i the',
    'but',
    'if',
    'if the',
    'and',
    'or',
    'to',
    'of',
    'it',
    'is',
    'in',
    'on',
    'my',
    'me',
    'you',
    'we',
    'they',
    'that',
    'this',
    'whether',
    'then',
    'than',
    'so',
    'yes',
    'no',
    'uh',
    'um',
    'ah',
    'oh',
    'hmm',
    'okay',
    'ok',
    'and the',
    'to the',
    'in the',
    'of the',
  ]);
  if (fillers.has(t)) return false;

  // SAPI often hears "WhatsApp" as "what is the / what is up"
  if (/^what\s+is\s+(the|up)$/.test(t)) return true;

  const commandHints = [
    'whatsapp',
    'gmail',
    'telegram',
    'discord',
    'settings',
    'profile',
    'workspace',
    'excel',
    'teams',
    'docs',
    'sheets',
    'slides',
    'calendar',
    'meet',
    'drive',
    'instagram',
    'word',
    'reload',
    'refresh',
    'back',
    'available',
    'service',
    'open',
    'create',
    'send',
    'type',
    'search',
  ];
  if (commandHints.some((h) => t === h || t.includes(h))) return true;

  for (const p of activePhrases) {
    const phrase = normalizeVoiceText(p);
    if (!phrase) continue;
    if (t === phrase || t.includes(phrase) || phrase.includes(t)) return true;
  }
  return false;
}

function attachSpeechHandlers(child, options = {}) {
  const engineName = options.engine || 'sapi';
  const onEarlyFail = options.onEarlyFail;
  let stdoutBuf = '';
  let idleCount = 0;
  let ready = false;
  let activeMic = '';
  let pendingResult = null;
  let earlyFailed = false;
  let fallbackStarted = false;

  const startFallback = () => {
    if (fallbackStarted || stopping || typeof onEarlyFail !== 'function') return;
    fallbackStarted = true;
    onEarlyFail();
  };

  child.__setActiveMic = (name) => {
    activeMic = String(name || '').trim();
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  const acceptConfidence = (confRaw) => {
    const conf = String(confRaw || '').trim();
    if (!conf) return true;
    if (conf === 'High' || conf === 'Medium') return true;
    if (conf === 'Low') return false;
    // SAPI dictation often reports 1.0 for garbage — ignore numeric confidence
    if (engineName.includes('sapi')) return true;
    const n = Number(conf);
    if (!Number.isFinite(n)) return true;
    return n >= 0.55;
  };

  const emitIfUseful = (text, conf) => {
    if (!text) return;
    if (!acceptConfidence(conf)) {
      console.log('[voice] rejected low confidence:', text, conf);
      return;
    }
    if (!isUsefulVoiceTranscript(text)) {
      console.log('[voice] ignored filler:', text);
      return;
    }
    idleCount = 0;
    console.log('[voice] recognized:', text, conf ? `(${conf})` : '');
    broadcast('voice-speech-result', { text: normalizeVoiceText(text), confidence: conf || null });
  };

  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk;
    const lines = stdoutBuf.split(/\r?\n/);
    stdoutBuf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (
        trimmed === 'READY' ||
        trimmed.startsWith('ENGINE:') ||
        trimmed.startsWith('SAPI_INPUT:') ||
        trimmed.startsWith('COMMANDS:') ||
        trimmed.startsWith('CONSTRAINT:') ||
        trimmed.startsWith('CONSTRAINTS_COUNT:') ||
        trimmed.startsWith('COMPILE:') ||
        trimmed.startsWith('LANG:') ||
        trimmed.startsWith('DICTATION:') ||
        trimmed.startsWith('INSTALLED:')
      ) {
        console.log('[voice:out]', trimmed);
        if (trimmed === 'READY') {
          ready = true;
          broadcast('voice-speech-status', {
            status: 'listening',
            engine: engineName,
            message: activeMic
              ? `Listening on: ${activeMic}`
              : 'Listening… say WhatsApp',
            micName: activeMic,
          });
        }
        continue;
      }

      if (trimmed.startsWith('REJECT:')) {
        console.log('[voice]', trimmed);
        continue;
      }

      if (trimmed === 'IDLE' || trimmed.startsWith('IDLE:')) {
        idleCount += 1;
        if (idleCount <= 3 || idleCount % 5 === 0) {
          console.log('[voice]', trimmed);
        }
        if (idleCount === 3 || idleCount % 6 === 0) {
          broadcast('voice-speech-status', {
            status: 'hint',
            message:
              engineName === 'winrt-online'
                ? 'Online speech listening — say "WhatsApp" then pause. Need internet + Settings → Privacy → Speech On.'
                : activeMic
                  ? `Listening on "${activeMic}" — say "WhatsApp" clearly`
                  : 'Say "WhatsApp" clearly',
          });
        }
        continue;
      }

      if (trimmed.startsWith('RESULT:')) {
        pendingResult = trimmed.slice(7).trim();
        continue;
      }

      if (trimmed.startsWith('CONF:')) {
        emitIfUseful(pendingResult, trimmed.slice(5).trim());
        pendingResult = null;
        continue;
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    console.warn('[voice:err]', text);
    if (text.includes('NO_MIC:')) {
      broadcast('voice-speech-status', {
        status: 'error',
        message: 'No microphone found.',
      });
    }
    if (text.includes('WINRT_FAIL:') && !ready) {
      earlyFailed = true;
    }
  });

  child.on('exit', (code) => {
    console.log(`[voice] exit ${engineName} code=`, code, 'ready=', ready);
    if (proc === child) proc = null;
    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }

    if (stopping) {
      restorePreviousMic();
      broadcast('voice-speech-status', { status: 'stopped' });
      return;
    }

    if (!ready && (earlyFailed || code === 4 || code === 1)) {
      startFallback();
      if (fallbackStarted) return;
    }

    restorePreviousMic();
    if (!ready) {
      broadcast('voice-speech-status', {
        status: 'error',
        message: 'Speech engine did not start.',
      });
      return;
    }
    broadcast('voice-speech-status', {
      status: 'error',
      message: 'Speech stopped unexpectedly.',
    });
  });

  if (readyTimer) clearTimeout(readyTimer);
  readyTimer = setTimeout(() => {
    if (proc === child && !ready && !stopping) {
      earlyFailed = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  }, 15000);

  return child;
}

function launchRecognizer(preferredName, engine) {
  const isOnline = engine === 'winrt-online';
  const script = isOnline ? buildWinRtOnlineScript() : buildSapiScript(activePhrases);
  const label = isOnline ? 'winrt-online' : 'sapi';

  scriptPath = path.join(
    os.tmpdir(),
    `textnexus-voice-${label}-${process.pid}-${Date.now()}.ps1`
  );
  fs.writeFileSync(scriptPath, script, 'utf8');
  console.log(`[voice] starting ${label} on mic:`, preferredName || '(default)');

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  proc = child;
  attachSpeechHandlers(child, {
    engine: label,
    onEarlyFail: isOnline
      ? () => {
          if (stopping) return;
          console.log('[voice] Online WinRT failed — falling back to SAPI dictation');
          broadcast('voice-speech-status', {
            status: 'mic-info',
            message: 'Online speech unavailable — using offline dictation…',
          });
          launchRecognizer(preferredName, 'sapi');
        }
      : undefined,
  });
  if (typeof child.__setActiveMic === 'function') {
    child.__setActiveMic(preferredName);
  }
  return child;
}

/**
 * @param {{ phrases?: string[] }} [options]
 */
export function startWindowsSpeech(options = {}) {
  if (!isWindowsSpeechAvailable()) {
    return { ok: false, error: 'Windows speech is only available on Windows.' };
  }

  stopWindowsSpeech();
  stopping = false;
  restoreMicScript = null;

  activePhrases = [
    ...new Set(
      [...defaultPhrases(), ...(Array.isArray(options.phrases) ? options.phrases : [])]
        .map((p) => String(p || '').trim().toLowerCase())
        .filter((p) => p.length >= 2 && p.length < 80)
    ),
  ].slice(0, 60);

  console.log('[voice] preparing microphone (prefer CMF / Bluetooth headset)…');
  broadcast('voice-speech-status', {
    status: 'mic-info',
    message: 'Switching to headset mic (CMF Buds)…',
  });

  let prevDefaultId = '';
  let preferredName = '';

  runPsFile(
    buildPrepareMicScript(),
    (line) => {
      console.log('[voice]', line);
      if (line.startsWith('PREV_DEFAULT_ID:')) {
        prevDefaultId = line.slice('PREV_DEFAULT_ID:'.length).trim();
      }
      if (line.startsWith('PREFERRED_MIC:')) {
        preferredName = line.slice('PREFERRED_MIC:'.length).trim();
      }
      if (line.startsWith('SWITCHED_DEFAULT_TO:')) {
        const name = line.slice('SWITCHED_DEFAULT_TO:'.length).trim();
        preferredName = name || preferredName;
        broadcast('voice-speech-status', {
          status: 'mic-info',
          message: `Using mic: ${name}`,
          micName: name,
        });
      }
      if (line.startsWith('ALREADY_DEFAULT:')) {
        preferredName = line.slice('ALREADY_DEFAULT:'.length).trim();
        broadcast('voice-speech-status', {
          status: 'mic-info',
          message: `Using mic: ${preferredName}`,
          micName: preferredName,
        });
      }
      if (line.startsWith('SWITCH_FAILED:')) {
        broadcast('voice-speech-status', {
          status: 'hint',
          message:
            'Could not auto-switch to CMF Buds. Sound settings → Input → set "Headset (CMF Buds 2a)" as Default (not Steam Streaming Microphone), then try again.',
        });
        try {
          spawn('cmd', ['/c', 'start', 'ms-settings:sound'], {
            windowsHide: true,
            stdio: 'ignore',
          });
        } catch {
          /* ignore */
        }
      }
      if (line.startsWith('SWITCH_RESULT:')) {
        console.log('[voice] switch detail:', line);
      }
    },
    () => {
      if (stopping) return;

      if (prevDefaultId) {
        restoreMicScript = buildRestoreMicScript(prevDefaultId);
      }

      // Skip broken WinRT PowerShell bridge — Whisper is primary in renderer.
      // SAPI remains as offline fallback only.
      launchRecognizer(preferredName, 'sapi');
    }
  );

  return { ok: true, phrases: activePhrases.length };
}

export function getWindowsSpeechStatus() {
  return {
    available: isWindowsSpeechAvailable(),
    listening: !!proc && !stopping,
  };
}
