export type SensoryCue = "tap" | "navigation" | "success" | "error";

const soundPreferenceKey = "account-manager-sound-enabled";
let audioContext: AudioContext | null = null;

export function isSoundEnabled() {
  try {
    return window.localStorage.getItem(soundPreferenceKey) !== "false";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(soundPreferenceKey, String(enabled));
  } catch {
    // Sound preference is optional and should not interrupt the app.
  }
}

export function playSensoryCue(cue: SensoryCue) {
  if (!isSoundEnabled()) return;

  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  audioContext ??= new AudioContextClass();
  const context = audioContext;
  if (context.state === "suspended") void context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const settings = {
    tap: { frequency: 520, duration: 0.045, volume: 0.035 },
    navigation: { frequency: 330, duration: 0.12, volume: 0.04 },
    success: { frequency: 660, duration: 0.18, volume: 0.045 },
    error: { frequency: 190, duration: 0.14, volume: 0.03 },
  }[cue];

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(settings.frequency, now);
  if (cue === "navigation")
    oscillator.frequency.linearRampToValueAtTime(440, now + settings.duration);
  if (cue === "success") oscillator.frequency.linearRampToValueAtTime(880, now + settings.duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(settings.volume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
  oscillator.start(now);
  oscillator.stop(now + settings.duration);
}
