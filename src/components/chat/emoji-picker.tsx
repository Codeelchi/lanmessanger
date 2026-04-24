'use client'

import { useState, type RefObject } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Smile } from 'lucide-react'

interface EmojiPickerProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onEmojiSelect?: (emoji: string) => void
}

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
      '😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋',
      '😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫',
      '🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠',
      '🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️',
      '😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰',
      '😥','😢','😭','😱','😖','😣','😞','😓','😩','😫',
      '🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
      '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹',
      '😻','😼','😽','🙀','😿','😾',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌',
      '🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '💯','🔥','⭐','🌟','✨','💫','🎉','🎊','🏆','🥇',
      '🎯','💡','📱','💻','🖥️','⌨️','🎮',
    ],
  },
  {
    name: 'Nature',
    emojis: [
      '🌸','🌺','🌻','🌹','🌷','🌱','🌿','☘️','🍀','🌿',
      '🍁','🍂','🍃','🌊','☀️','🌙','⭐','🌈','☁️','🔥',
      '💧','❄️','🎉',
    ],
  },
]

export function EmojiPicker({ textareaRef, onEmojiSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState('Smileys')

  const handleEmojiClick = (emoji: string) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value

      // Insert emoji at cursor position
      const newValue = value.substring(0, start) + emoji + value.substring(end)

      // Create and dispatch input event so React picks up the change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, newValue)
      } else {
        textarea.value = newValue
      }

      textarea.dispatchEvent(new Event('input', { bubbles: true }))

      // Move cursor after the inserted emoji
      const newCursorPos = start + emoji.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }

    onEmojiSelect?.(emoji)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground flex-shrink-0 rounded-lg hover:bg-muted/80 transition-colors"
          aria-label="Insert emoji"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-72 p-0 border-border/50 shadow-xl"
      >
        {/* Category tabs */}
        <div className="flex border-b border-border/30 px-2 pt-2 gap-1 overflow-x-auto scrollbar-none">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 ${
                activeCategory === cat.name
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="p-2 max-h-64 overflow-y-auto">
          {EMOJI_CATEGORIES.filter((c) => c.name === activeCategory).map((cat) => (
            <div
              key={cat.name}
              className="grid grid-cols-8 gap-0.5"
            >
              {cat.emojis.map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  onClick={() => handleEmojiClick(emoji)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-lg hover:bg-muted/80 dark:hover:bg-muted/60 transition-all duration-150 cursor-pointer active:scale-90 hover:scale-110"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
