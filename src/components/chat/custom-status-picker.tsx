'use client'

import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X } from 'lucide-react'

const STATUS_EMOJIS = [
  '🎮', '☕', '📝', '🎵', '💻', '🏃', '📚', '🎯', '🍽️', '😴', '🎉', '💡',
]

interface CustomStatusPickerProps {
  currentStatus?: string
  onSetStatus: (status: string) => void
  onClearStatus: () => void
  trigger: ReactNode
}

function extractEmoji(status?: string): string {
  if (!status) return ''
  const match = status.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u)
  return match ? match[1] : ''
}

function extractText(status?: string): string {
  if (!status) return ''
  return status.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, '').trim()
}

export function CustomStatusPicker({
  currentStatus,
  onSetStatus,
  onClearStatus,
  trigger,
}: CustomStatusPickerProps) {
  const [selectedEmoji, setSelectedEmoji] = useState(() => extractEmoji(currentStatus))
  const [customText, setCustomText] = useState(() => extractText(currentStatus))
  const [open, setOpen] = useState(false)

  const handleSetStatus = () => {
    if (!selectedEmoji && !customText.trim()) return
    const status = `${selectedEmoji} ${customText.trim()}`.trim()
    onSetStatus(status)
    setOpen(false)
  }

  const handleClear = () => {
    setSelectedEmoji('')
    setCustomText('')
    onClearStatus()
    setOpen(false)
  }

  const handleSelectEmoji = (emoji: string) => {
    setSelectedEmoji((prev) => (prev === emoji ? '' : emoji))
  }

  const previewText = selectedEmoji && customText.trim()
    ? `${selectedEmoji} ${customText.trim()}`
    : selectedEmoji
      ? selectedEmoji
      : customText.trim()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" side="bottom" align="start">
        <div className="space-y-3 p-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Set Status</h4>
            <button
              onClick={() => setOpen(false)}
              className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* Preview */}
          {previewText && (
            <div className="bg-muted/60 rounded-lg px-3 py-2 text-sm text-foreground">
              {previewText}
            </div>
          )}

          {/* Emoji grid */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5">Quick emoji</p>
            <div className="grid grid-cols-6 gap-1">
              {STATUS_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-all duration-150 hover:scale-110 active:scale-95 ${
                    selectedEmoji === emoji
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500/50 shadow-sm'
                      : 'hover:bg-muted/80'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Custom text input */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground/70 mb-1.5">What are you up to?</p>
            <div className="relative">
              {selectedEmoji && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                  {selectedEmoji}
                </span>
              )}
              <Input
                placeholder="Working, gaming, away..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value.slice(0, 30))}
                className={`h-9 text-sm ${selectedEmoji ? 'pl-8' : 'pl-3'}`}
                maxLength={30}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSetStatus()
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-1 text-right">
              {customText.length}/30
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={handleClear}
              disabled={!currentStatus}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSetStatus}
              disabled={!selectedEmoji && !customText.trim()}
            >
              <Check className="h-3 w-3 mr-1" />
              Set Status
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
