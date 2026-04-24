'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  File,
  Download,
  Loader2,
  Play,
  Pause,
} from 'lucide-react'

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileIcon(fileType: string, fileName: string): React.ReactNode {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  if (fileType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <FileImage className="h-5 w-5 text-emerald-500" />
  }
  if (fileType === 'video' || ['mp4', 'avi', 'mov', 'mkv'].includes(ext)) {
    return <FileVideo className="h-5 w-5 text-violet-500" />
  }
  if (fileType === 'audio' || ['mp3', 'wav', 'ogg'].includes(ext)) {
    return <FileAudio className="h-5 w-5 text-amber-500" />
  }
  if (fileType === 'pdf' || ext === 'pdf') {
    return <FileText className="h-5 w-5 text-red-500" />
  }
  if (fileType === 'spreadsheet' || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
  }
  if (fileType === 'archive' || ['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-orange-500" />
  }
  if (fileType === 'document' || ['doc', 'docx', 'txt'].includes(ext)) {
    return <FileText className="h-5 w-5 text-blue-500" />
  }
  if (fileType === 'presentation' || ['ppt', 'pptx'].includes(ext)) {
    return <FileText className="h-5 w-5 text-orange-600" />
  }

  return <File className="h-5 w-5 text-muted-foreground" />
}

export function ImagePreview({
  fileUrl,
  fileName,
  onImageClick,
}: {
  fileUrl: string
  fileName: string
  onImageClick?: (url: string) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10">
        <FileImage className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {fileName}
        </span>
      </div>
    )
  }

  return (
    <div className="relative group/img max-w-[300px]">
      {!loaded && (
        <div className="w-[200px] h-[150px] rounded-lg bg-muted/30 dark:bg-muted/20 flex items-center justify-center animate-pulse">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
        </div>
      )}
      <img
        src={fileUrl}
        alt={fileName}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        onClick={() => onImageClick?.(fileUrl)}
        className={`max-w-[300px] max-h-[300px] rounded-lg shadow-sm transition-all duration-200 ${
          onImageClick ? 'cursor-pointer hover:shadow-md hover:brightness-[1.02] active:scale-[0.98]' : ''
        } ${loaded ? 'opacity-100' : 'opacity-0 absolute'}`}
        loading="lazy"
      />
    </div>
  )
}

export function FileAttachmentCard({
  fileUrl,
  fileName,
  fileSize,
  fileType,
}: {
  fileUrl: string
  fileName: string
  fileSize?: number
  fileType?: string
}) {
  const icon = getFileIcon(fileType || '', fileName)
  const sizeStr = fileSize ? formatFileSize(fileSize) : ''

  return (
    <a
      href={fileUrl}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-200 max-w-[280px] group/file no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-background/80 dark:bg-muted/30 flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground leading-tight">
          {fileName}
        </p>
        {sizeStr && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            {sizeStr}
          </p>
        )}
      </div>
      <Download className="h-4 w-4 text-muted-foreground/60 group-hover/file:text-muted-foreground flex-shrink-0 transition-colors" />
    </a>
  )
}

export function FilePreview({
  fileUrl,
  fileName,
  fileSize,
  fileType,
  onImageClick,
  isOwn,
}: {
  fileUrl: string
  fileName: string
  fileSize?: number
  fileType?: string
  onImageClick?: (url: string) => void
  isOwn?: boolean
}) {
  if (!fileUrl) return null

  const isImage = fileType === 'image' || /^image\//.test(fileType || '')
  const isAudio = fileType === 'audio' || /^audio\//.test(fileType || '') || fileName.startsWith('voice_')

  if (isImage) {
    return (
      <ImagePreview
        fileUrl={fileUrl}
        fileName={fileName}
        onImageClick={onImageClick}
      />
    )
  }

  if (isAudio) {
    return (
      <VoiceMessagePlayer
        fileUrl={fileUrl}
        fileName={fileName}
        isOwn={isOwn}
      />
    )
  }

  return (
    <FileAttachmentCard
      fileUrl={fileUrl}
      fileName={fileName}
      fileSize={fileSize}
      fileType={fileType}
    />
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Audio player for voice messages
export function VoiceMessagePlayer({
  fileUrl,
  fileName,
 isOwn,
}: {
  fileUrl: string
  fileName: string
  isOwn?: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const animationRef = useRef<number | null>(null)

  // Extract duration from filename if available (format: voice_Ns.webm)
  const durationMatch = fileName.match(/voice_(\d+)s/)
  const presetDuration = durationMatch ? parseInt(durationMatch[1]) : 0

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play().catch(() => {})
      setIsPlaying(true)
      const updateLoop = () => {
        setProgress(audio.currentTime / (audio.duration || 1))
        setCurrentTime(audio.currentTime)
        animationRef.current = requestAnimationFrame(updateLoop)
      }
      animationRef.current = requestAnimationFrame(updateLoop)
    } else {
      audio.pause()
      setIsPlaying(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [presetDuration])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || presetDuration)
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(1)
      setCurrentTime(audio.duration || presetDuration)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [presetDuration])

  const displayDuration = duration > 0 ? duration : presetDuration

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={fileUrl} preload="metadata" />
      <button
        onClick={(e) => {
          e.stopPropagation()
          togglePlayPause()
        }}
        className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        {/* Waveform bars */}
        <div className="flex items-center gap-[2px] h-5 mb-1">
          {Array.from({ length: 24 }, (_, i) => {
            const base = Math.sin(i * 0.5) * 0.3 + 0.5
            const noise = Math.sin(i * 2.1) * 0.15 + Math.cos(i * 0.7) * 0.1
            const h = Math.max(0.12, Math.min(1, base + noise))
            const isPast = i / 24 <= progress
            return (
              <div
                key={i}
                className={`w-[2px] rounded-full transition-all duration-100 ${
                  isOwn
                    ? isPast ? 'bg-white/80' : 'bg-white/25'
                    : isPast
                      ? 'bg-emerald-500 dark:bg-emerald-400'
                      : 'bg-muted-foreground/25'
                }`}
                style={{ height: `${Math.max(3, h * 20)}px` }}
              />
            )
          })}
        </div>
        {/* Time */}
        <div className={`text-[10px] font-mono tabular-nums ${isOwn ? 'text-white/60' : 'text-muted-foreground/60'}`}>
          {formatDuration(currentTime)} / {formatDuration(displayDuration)}
        </div>
      </div>
    </div>
  )
}

export { formatFileSize, getFileIcon, formatDuration }
