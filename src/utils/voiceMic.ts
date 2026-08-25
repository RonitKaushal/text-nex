/** Prefer CMF / Bluetooth headset capture device in the host window. */

export async function pickPreferredMicDeviceId(): Promise<{
  deviceId: string | null;
  label: string;
}> {
  try {
    const warm = await navigator.mediaDevices.getUserMedia({ audio: true });
    warm.getTracks().forEach((t) => t.stop());
  } catch {
    /* continue */
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((d) => d.kind === 'audioinput');
  const scored = inputs
    .map((d) => {
      const n = (d.label || '').toLowerCase();
      let score = 0;
      if (/cmf|buds 2a/.test(n)) score += 100;
      if (/buds|airpods|bluetooth|hands-?free|headset/.test(n)) score += 50;
      if (/steam|vb-audio|cable|stereo mix|mapped/.test(n)) score -= 80;
      return { d, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && best.score > 0) {
    return { deviceId: best.d.deviceId, label: best.d.label || 'Headset mic' };
  }
  const def = inputs[0];
  return {
    deviceId: def?.deviceId || null,
    label: def?.label || 'Default microphone',
  };
}
