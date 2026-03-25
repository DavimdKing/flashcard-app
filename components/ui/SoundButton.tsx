'use client'

import { useRef, useState } from 'react'

interface Props {
  audioUrl: string | null
}

export default function SoundButton({ audioUrl }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleClick = () => {
    if (!audioUrl) return
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
    }
  }

  if (!audioUrl) {
    return (
      <button
        type="button"
        className="w-11 h-11 rounded-full bg-white/60 flex items-center justify-center shadow"
        disabled
        title="Audio unavailable"
        aria-label="Play pronunciation (unavailable)"
      >
        <span className="text-red-400 text-xs font-bold">!</span>
      </button>
    )
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        onClick={handleClick}
        aria-label="Play pronunciation"
        className={`w-11 h-11 rounded-full bg-white/70 flex items-center justify-center shadow hover:bg-white/90 transition ${isPlaying ? 'scale-95' : ''}`}
      >
        🔊
      </button>
    </>
  )
}
