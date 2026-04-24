'use client'

// Web Audio API notification sound generator - no audio files needed
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const settings = localStorage.getItem('lanchat-settings')
    if (settings) {
      const parsed = JSON.parse(settings)
      return parsed.sound !== false
    }
  } catch {
    // ignore parse errors
  }
  return true // default to enabled
}

function playTone(
  frequencies: number[],
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.15,
  gap: number = 0
) {
  if (!isSoundEnabled()) return

  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    let startTime = ctx.currentTime
    const totalDuration = duration + gap

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()

      osc.type = type
      osc.frequency.setValueAtTime(freq, startTime)

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(startTime + duration)

      startTime += totalDuration
    })
  } catch {
    // Audio not supported or blocked by browser
  }
}

/**
 * Short pleasant "ding" for new incoming messages.
 * Two-note ascending chime, ~250ms total.
 */
export function playMessageSound() {
  playTone([880, 1108.73], 0.12, 'sine', 0.12, 0.04)
}

/**
 * Soft "pop" for user join notifications.
 * Quick rounded tone, ~150ms.
 */
export function playJoinSound() {
  playTone([660], 0.15, 'sine', 0.1)
}

/**
 * Subtle "whoosh" for sent messages confirmation.
 * Quick descending sweep, ~200ms.
 */
export function playSendSound() {
  if (!isSoundEnabled()) return

  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.12)

    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Audio not supported or blocked by browser
  }
}
