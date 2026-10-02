import { useEffect, useRef } from 'react'
import trackUrl from './audio/black-diamond.mp3'

export function useBgm(muted: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(trackUrl)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.26
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (muted) {
      audio.pause()
      return
    }
    const resume = () => {
      audio.play().catch(() => {})
    }
    resume()
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [muted])
}
