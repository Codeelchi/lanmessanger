'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Send, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void
  onCancel: () => void
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function cleanupResources(
  timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  animFrameRef: React.MutableRefObject<number | null>,
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  streamRef: React.MutableRefObject<MediaStream | null>,
  analyserRef: React.MutableRefObject<AnalyserNode | null>,
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>,
) {
  if (timerRef.current) {
    clearInterval(timerRef.current)
    timerRef.current = null
  }
  if (animFrameRef.current) {
    cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = null
  }
  if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    audioContextRef.current.close().catch(() => {})
    audioContextRef.current = null
  }
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  analyserRef.current = null
  mediaRecorderRef.current = null
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [duration, setDuration] = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>(new Array(10).fill(0.15))
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Refs to hold stable references for cleanup function
  const refs = useRef({
    timerRef,
    animFrameRef,
    audioContextRef,
    streamRef,
    analyserRef,
    mediaRecorderRef,
  })

  const doCleanup = useCallback(() => {
    const r = refs.current
    cleanupResources(r.timerRef, r.animFrameRef, r.audioContextRef, r.streamRef, r.analyserRef, r.mediaRecorderRef)
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const r = refs.current
      cleanupResources(r.timerRef, r.animFrameRef, r.audioContextRef, r.streamRef, r.analyserRef, r.mediaRecorderRef)
    }
  }, [])

  // Auto-start recording on mount: request mic + set up MediaRecorder
  // setState calls are only in async callbacks after await, not synchronously in effect body
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        setHasPermission(true)

        // Set up Web Audio API for waveform visualization
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        analyserRef.current = analyser

        // Start waveform animation loop
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const updateWaveform = () => {
          analyser.getByteFrequencyData(dataArray)
          const barCount = 10
          const newData: number[] = []
          for (let i = 0; i < barCount; i++) {
            const index = Math.floor((i / barCount) * dataArray.length * 0.6)
            const value = dataArray[index] || 0
            const normalized = Math.max(0.08, (value / 255) * 0.92 + 0.08)
            newData.push(normalized)
          }
          setWaveformData(newData)
          animFrameRef.current = requestAnimationFrame(updateWaveform)
        }
        animFrameRef.current = requestAnimationFrame(updateWaveform)

        // Set up MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/ogg'

        const mediaRecorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }

        mediaRecorder.start(100)
        setIsRecording(true)
        startTimeRef.current = Date.now()

        // Duration timer
        timerRef.current = setInterval(() => {
          setDuration((Date.now() - startTimeRef.current) / 1000)
        }, 100)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone permission.')
        } else {
          setError('Could not access microphone. Please check your device.')
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  // Stop recording and send
  const handleStopAndSend = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return

    const finalDuration = (Date.now() - startTimeRef.current) / 1000

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
      const r = refs.current
      cleanupResources(r.timerRef, r.animFrameRef, r.audioContextRef, r.streamRef, r.analyserRef, r.mediaRecorderRef)
      setIsRecording(false)
      onSend(blob, finalDuration)
    }

    mediaRecorder.stop()
  }, [onSend])

  // Cancel recording
  const handleCancel = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        chunksRef.current = []
      }
      mediaRecorder.stop()
    }
    const r = refs.current
    cleanupResources(r.timerRef, r.animFrameRef, r.audioContextRef, r.streamRef, r.analyserRef, r.mediaRecorderRef)
    setIsRecording(false)
    setDuration(0)
    setWaveformData(new Array(10).fill(0.15))
    onCancel()
  }, [onCancel])

  return (
    <div className="px-4 py-3">
      {error ? (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-destructive font-medium">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-muted/80"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* Recording indicator + timer */}
          <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[110px]">
            <div className="relative flex items-center justify-center">
              <Mic className="h-4 w-4 text-rose-500" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 animate-recording-dot" />
            </div>
            <span className="text-sm font-mono font-medium tabular-nums text-foreground/80">
              {formatTimer(duration)}
            </span>
          </div>

          {/* Waveform visualization */}
          <div className="flex-1 flex items-center justify-center gap-[3px] h-8">
            {waveformData.map((value, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-gradient-to-t from-emerald-500 to-teal-400 dark:from-emerald-400 dark:to-teal-300 transition-all duration-75"
                style={{
                  height: `${Math.max(4, value * 32)}px`,
                  opacity: isRecording ? 1 : 0.4,
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Cancel button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 active:scale-90"
              onClick={handleCancel}
              title="Cancel recording"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Send button */}
            {isRecording && (
              <Button
                size="icon"
                className="h-9 w-9 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/25 transition-all duration-200 active:scale-90 disabled:opacity-40"
                onClick={handleStopAndSend}
                title="Send voice message"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Permission request state */}
      {!hasPermission && !error && !isRecording && (
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-emerald-500 animate-spin" />
          <p className="text-xs text-muted-foreground">Requesting microphone access...</p>
        </div>
      )}
    </div>
  )
}
