let audioContext: AudioContext | null = null

function context() {
  if (!audioContext) audioContext = new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function tone(frequency: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0, endFrequency?: number) {
  try {
    const ctx = context()
    const start = ctx.currentTime + delay
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  } catch {
    // Audio is optional in embedded browsers.
  }
}

export function playSound(name: 'start' | 'brake' | 'safe' | 'great' | 'edge' | 'fall' | 'button', muted: boolean) {
  if (muted) return
  if (name === 'start') tone(180, 0.1, 0.08, 'triangle', 0, 260)
  if (name === 'brake') tone(135, 0.15, 0.07, 'sawtooth', 0, 82)
  if (name === 'safe') tone(320, 0.09, 0.1)
  if (name === 'great') {
    tone(420, 0.11, 0.11)
    tone(620, 0.12, 0.11, 'sine', 0.075)
  }
  if (name === 'edge') {
    tone(520, 0.12, 0.12)
    tone(780, 0.14, 0.12, 'sine', 0.055)
    tone(1040, 0.16, 0.12, 'sine', 0.11)
  }
  if (name === 'fall') tone(160, 0.42, 0.13, 'sawtooth', 0, 55)
  if (name === 'button') tone(600, 0.045, 0.06)
}
