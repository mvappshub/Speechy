'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, Pause, Copy, Trash2, Clock, Wand2, Volume2, Loader2, AlertCircle, Server } from 'lucide-react'

const TTS_API = 'http://localhost:8000'

export default function Home() {
  // State
  const [text, setText] = useState('Ahoj. Napiš cokoliv a já to přečtu pomocí modelu MMS-TTS-CES.')
  const [playbackState, setPlaybackState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  const [speed, setSpeed] = useState<number>(1.0)
  const [volume, setVolume] = useState<number>(1)
  const [textScale, setTextScale] = useState<number>(0.35)
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [error, setError] = useState<string | null>(null)

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const chunksRef = useRef<string[]>([])
  const currentChunkRef = useRef(0)

  // Check server health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${TTS_API}/api/health`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) setServerStatus('online')
        else setServerStatus('offline')
      } catch {
        setServerStatus('offline')
      }
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  // Auto-save
  useEffect(() => {
    const saved = localStorage.getItem('ttsCzechState')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.text) setText(parsed.text)
        if (parsed.speed) setSpeed(parsed.speed)
        if (parsed.volume) setVolume(parsed.volume)
        if (parsed.textScale) setTextScale(parsed.textScale)
      } catch (e) { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('ttsCzechState', JSON.stringify({ text, speed, volume, textScale }))
  }, [text, speed, volume, textScale])

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
    }
  }, [])

  // Derived
  const chunks = React.useMemo(
    () => text.match(/[^.?!:\n]+[.?!:\n]*\s*/g) || [text],
    [text]
  )
  const estimatedTime = React.useMemo(() => {
    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length
    if (wordCount === 0) return '0 s'
    const timeInMinutes = wordCount / (200 * speed)
    const minutes = Math.floor(timeInMinutes)
    const seconds = Math.round((timeInMinutes - minutes) * 60)
    return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`
  }, [text, speed])

  // Play handler
  const handlePlay = useCallback(async () => {
    if (!text.trim()) return
    if (serverStatus !== 'online') {
      setError('TTS server není dostupný. Ujistěte se, že Python backend běží na portu 8000.')
      return
    }

    setError(null)
    setPlaybackState('loading')

    try {
      // Split into chunks and synthesize
      chunksRef.current = text.match(/[^.?!:\n]+[.?!:\n]*\s*/g) || [text]
      currentChunkRef.current = 0

      // For shorter texts, synthesize all at once
      // For longer texts, we chunk and synthesize the first part
      const chunkToSynthesize = text.length > 500
        ? chunksRef.current.slice(0, 3).join('')
        : text

      const res = await fetch(`${TTS_API}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunkToSynthesize, speed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errData.detail || 'Synthesis failed')
      }

      const blob = await res.blob()

      // Cleanup previous audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }

      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      const audio = new Audio(url)
      audio.volume = volume
      audioRef.current = audio

      audio.onended = () => {
        setPlaybackState('idle')
        currentChunkRef.current = 0
      }

      audio.onerror = () => {
        setError('Chyba při přehrávání zvuku.')
        setPlaybackState('idle')
      }

      await audio.play()
      setPlaybackState('playing')
    } catch (e: any) {
      setError(e.message || 'Syntéza selhala.')
      setPlaybackState('idle')
    }
  }, [text, speed, volume, serverStatus])

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setPlaybackState('paused')
    }
  }, [])

  const handleResume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
      setPlaybackState('playing')
    }
  }, [])

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setPlaybackState('idle')
    currentChunkRef.current = 0
  }, [])

  const handleCleanText = useCallback(() => {
    let cleaned = text
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '')
    cleaned = cleaned.replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2')
    cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2')
    cleaned = cleaned.replace(/~~(.*?)~~/g, '$1')
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1')
    cleaned = cleaned.replace(/^#+\s+/gm, '')
    cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '')
    cleaned = cleaned.replace(/^[>\-\*\+]\s+/gm, '')
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '')
    cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, '')
    cleaned = cleaned.replace(/[|~^<>{}\[\]\\]/g, ' ')
    cleaned = cleaned.replace(/\n{2,}/g, '\n')
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ')
    setText(cleaned.trim())
  }, [text])

  const handleClear = useCallback(() => {
    if (window.confirm('Opravdu chcete vymazat veškerý text?')) {
      setText('')
      handleStop()
    }
  }, [handleStop])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
  }, [text])

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row font-sans bg-white">
      {/* Left Column: Text Canvas */}
      <div className="w-full md:w-2/3 p-6 md:p-12 lg:p-20 flex flex-col min-h-[60vh] md:min-h-screen relative">
        {/* Top Actions Bar */}
        <div className="flex justify-between items-center mb-12 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>Odhad: {estimatedTime}</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleCleanText}
              className="hover:text-black transition-colors flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3" /> Vyčistit
            </button>
            <button
              onClick={handleCopy}
              className="hover:text-black transition-colors flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Kopírovat
            </button>
            <button
              onClick={handleClear}
              className="hover:text-red-500 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Vymazat
            </button>
          </div>
        </div>

        {/* Server Status Banner */}
        {serverStatus === 'offline' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <strong>TTS server není dostupný.</strong> Spusťte Python backend:
              <code className="block mt-1 bg-amber-100 px-2 py-1 rounded text-xs font-mono">
                cd tts-server && python3 server.py
              </code>
              Model <code className="bg-amber-100 px-1 rounded">facebook/mms-tts-ces</code> se při prvním spuštění stáhne z HuggingFace (~80 MB).
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800">{error}</div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Text Area / Highlighted Text */}
        <div className="flex-grow relative">
          {playbackState === 'idle' || playbackState === 'loading' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ fontSize: `calc(clamp(2rem, 6vw, 6.25rem) * ${textScale})`, lineHeight: 0.9 }}
              className="absolute inset-0 w-full h-full bg-transparent font-[family-name:var(--font-geist-mono)] font-light tracking-tighter outline-none resize-none placeholder-gray-200"
              placeholder="Napište text zde..."
              spellCheck="false"
              disabled={playbackState === 'loading'}
            />
          ) : (
            <div
              style={{ fontSize: `calc(clamp(2rem, 6vw, 6.25rem) * ${textScale})`, lineHeight: 0.9 }}
              className="absolute inset-0 w-full h-full overflow-y-auto pb-32 font-[family-name:var(--font-geist-mono)] font-light tracking-tighter cursor-default"
            >
              {chunks.map((chunk, i) => (
                <span
                  key={i}
                  className={`transition-all duration-300 ${
                    playbackState === 'playing'
                      ? 'text-black opacity-100'
                      : 'text-gray-400 opacity-60'
                  }`}
                >
                  {chunk}
                </span>
              ))}
            </div>
          )}

          {/* Loading overlay */}
          {playbackState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-black" />
                <span className="text-xs uppercase tracking-[0.2em] text-gray-500 font-medium">
                  Syntetizuji zvuk...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Controls */}
      <div className="w-full md:w-1/3 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 p-8 md:p-12 lg:p-20 flex flex-col justify-between">
        <div className="space-y-16">
          {/* Header */}
          <div>
            <h1 className="text-xs font-medium uppercase tracking-[0.2em] text-black mb-2">
              Předčítač Českého Textu
            </h1>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-gray-400">
              <span>v2.0 / MMS-TTS-CES</span>
              <span className="mx-1">•</span>
              <span className="flex items-center gap-1">
                <Server className="w-2.5 h-2.5" />
                <span className={serverStatus === 'online' ? 'text-green-600' : serverStatus === 'offline' ? 'text-red-500' : 'text-gray-400'}>
                  {serverStatus === 'online' ? 'Server online' : serverStatus === 'offline' ? 'Server offline' : 'Kontroluji...'}
                </span>
              </span>
            </div>
          </div>

          {/* Model Info */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">Model TTS</span>
            </div>
            <p className="text-sm font-mono text-black">facebook/mms-tts-ces</p>
            <p className="text-[10px] text-gray-400 mt-1">
              VITS architektura • Lokální infernce • 16kHz WAV
            </p>
          </div>

          {/* Settings */}
          <div className="space-y-12">
            {/* Sliders */}
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">
                  <label>Rychlost</label>
                  <span className="text-black">{speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  disabled={playbackState !== 'idle'}
                  className="disabled:opacity-50 w-full"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">
                  <label>Hlasitost</label>
                  <span className="text-black">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setVolume(v)
                    if (audioRef.current) audioRef.current.volume = v
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">
                  <label>Velikost textu</label>
                  <span className="text-black">{Math.round(textScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.05"
                  value={textScale}
                  onChange={(e) => setTextScale(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-16 space-y-3">
          {playbackState === 'idle' && (
            <button
              onClick={handlePlay}
              disabled={serverStatus !== 'online' || !text.trim()}
              className="group w-full flex items-center justify-between border border-black bg-black text-white px-6 py-5 hover:bg-white hover:text-black transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em]">Přehrát</span>
              <Play className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          )}
          {playbackState === 'loading' && (
            <button
              disabled
              className="group w-full flex items-center justify-between border border-gray-300 bg-gray-100 text-gray-500 px-6 py-5 cursor-wait"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em]">Syntetizuji...</span>
              <Loader2 className="w-4 h-4 animate-spin" />
            </button>
          )}
          {playbackState === 'playing' && (
            <button
              onClick={handlePause}
              className="group w-full flex items-center justify-between border border-black bg-white text-black px-6 py-5 hover:bg-gray-100 transition-colors duration-300"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em]">Pozastavit</span>
              <Pause className="w-4 h-4" />
            </button>
          )}
          {playbackState === 'paused' && (
            <button
              onClick={handleResume}
              className="group w-full flex items-center justify-between border border-black bg-black text-white px-6 py-5 hover:bg-gray-800 transition-colors duration-300"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em]">Pokračovat</span>
              <Play className="w-4 h-4" />
            </button>
          )}
          {playbackState !== 'idle' && playbackState !== 'loading' && (
            <button
              onClick={handleStop}
              className="group w-full flex items-center justify-between border border-gray-300 bg-transparent text-gray-500 px-6 py-4 hover:border-black hover:text-black transition-colors duration-300"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Zastavit</span>
              <Square className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
