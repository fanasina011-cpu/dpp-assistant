/**
 * Sons de notification générés via Web Audio API (pas de fichiers à héberger).
 * 4 sons disponibles + preview.
 */

export type SoundId = 'bip' | 'ding' | 'pop' | 'doux'

export const SOUNDS: { id: SoundId; label: string; description: string }[] = [
  { id: 'bip', label: 'Bip', description: 'Double note courte' },
  { id: 'ding', label: 'Ding', description: 'Note cristalline unique' },
  { id: 'pop', label: 'Pop', description: 'Note grave discrète' },
  { id: 'doux', label: 'Doux', description: 'Trio ascendant léger' },
]

let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedContext) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return null
      sharedContext = new AudioContextClass()
    }
    // Reprend si suspendu
    if (sharedContext.state === 'suspended') {
      sharedContext.resume().catch(() => {})
    }
    return sharedContext
  } catch {
    return null
  }
}

function beep(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq

  const t0 = ctx.currentTime + startAt
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration)
}

function playBip(ctx: AudioContext) {
  // Double note courte (La5 → Ré6)
  beep(ctx, 880, 0, 0.12, 0.08)
  beep(ctx, 1174, 0.1, 0.15, 0.06)
}

function playDing(ctx: AudioContext) {
  // Note cristalline unique (Sol6)
  beep(ctx, 1568, 0, 0.6, 0.07, 'sine')
}

function playPop(ctx: AudioContext) {
  // Note grave discrète (Mi4 → court)
  beep(ctx, 330, 0, 0.08, 0.1, 'triangle')
}

function playDoux(ctx: AudioContext) {
  // Trio ascendant doux (Do5 → Mi5 → Sol5)
  beep(ctx, 523, 0, 0.12, 0.05)
  beep(ctx, 659, 0.08, 0.12, 0.05)
  beep(ctx, 784, 0.16, 0.2, 0.05)
}

export function playSound(soundId: SoundId) {
  const ctx = getAudioContext()
  if (!ctx) return

  switch (soundId) {
    case 'bip':
      playBip(ctx)
      break
    case 'ding':
      playDing(ctx)
      break
    case 'pop':
      playPop(ctx)
      break
    case 'doux':
      playDoux(ctx)
      break
  }

  // Pas de close — on garde le contexte partagé
}