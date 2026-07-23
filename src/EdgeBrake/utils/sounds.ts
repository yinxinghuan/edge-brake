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

export function playSound(name: 'charge' | 'powerReady' | 'launch' | 'autoBrake' | 'safe' | 'great' | 'edge' | 'earlyFail' | 'fall' | 'button' | 'coin' | 'unlock' | 'deny' | 'weatherSnow' | 'weatherFog' | 'weatherBlizzard', muted: boolean, intensity = 0.5) {
  if (muted) return
  if (name === 'charge') tone(180, 0.14, 0.06, 'triangle', 0, 260)
  if (name === 'powerReady') tone(520, 0.055, 0.045)
  if (name === 'launch') {
    const power = Math.min(1, Math.max(0.12, intensity))
    const startFrequency = 210 + power * 210
    tone(startFrequency, 0.12, 0.075 + power * 0.055, 'triangle', 0, startFrequency * 1.45)
    tone(88, 0.055, 0.045 + power * 0.035, 'square')
  }
  if (name === 'autoBrake') {
    tone(260, 0.15, 0.075, 'square', 0, 150)
    tone(90, 0.08, 0.055, 'triangle', 0.025, 62)
  }
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
  if (name === 'earlyFail') {
    tone(210, 0.16, 0.1, 'square', 0, 145)
    tone(118, 0.26, 0.09, 'sawtooth', 0.12, 72)
  }
  if (name === 'fall') tone(160, 0.42, 0.13, 'sawtooth', 0, 55)
  if (name === 'button') tone(600, 0.045, 0.06)
  if (name === 'coin') {
    tone(880, 0.08, 0.08)
    tone(1180, 0.09, 0.07, 'sine', 0.045)
  }
  if (name === 'unlock') {
    tone(420, 0.11, 0.1)
    tone(620, 0.12, 0.1, 'sine', 0.07)
    tone(840, 0.14, 0.11, 'sine', 0.14)
  }
  if (name === 'weatherSnow') tone(390, 0.07, 0.04, 'triangle', 0, 450)
  if (name === 'weatherFog') tone(240, 0.11, 0.04, 'sine', 0, 190)
  if (name === 'weatherBlizzard') tone(180, 0.13, 0.045, 'triangle', 0, 120)
  if (name === 'deny') tone(90, 0.12, 0.075, 'square', 0, 70)
}
