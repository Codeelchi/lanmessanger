'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  KEYBOARD_SHORTCUTS,
  CATEGORY_LABELS,
  getShortcutLabel,
  type KeyboardShortcut,
} from '@/lib/keyboard-shortcuts'
import { Keyboard, Compass, MessageSquare, Settings } from 'lucide-react'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORY_ICONS: Record<KeyboardShortcut['category'], React.ReactNode> = {
  navigation: <Compass className="h-4 w-4 text-emerald-500" />,
  messaging: <MessageSquare className="h-4 w-4 text-teal-500" />,
  general: <Settings className="h-4 w-4 text-amber-500" />,
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md border border-border/80 bg-muted/60 text-[11px] font-mono font-medium text-muted-foreground shadow-[0_1px_0_1px_hsl(var(--border))]">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const categories = Object.keys(CATEGORY_LABELS) as KeyboardShortcut['category'][]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Keyboard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use keyboard shortcuts to navigate and interact faster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {categories.map((category) => {
            const shortcuts = KEYBOARD_SHORTCUTS.filter((s) => s.category === category)
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2.5">
                  {CATEGORY_ICONS[category]}
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[category]}
                  </span>
                </div>
                <div className="space-y-1">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={`${shortcut.key}-${shortcut.ctrl ? 'ctrl' : ''}-${shortcut.shift ? 'shift' : ''}-${shortcut.alt ? 'alt' : ''}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-foreground/80">
                        {shortcut.description}
                      </span>
                      <ShortcutKeys shortcut={shortcut} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2 text-[10px] text-muted-foreground/70 border-t mt-4">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Press
          </span>
          <Kbd>Shift</Kbd>
          <span>+</span>
          <Kbd>?</Kbd>
          <span>anytime to open this dialog</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutKeys({ shortcut }: { shortcut: KeyboardShortcut }) {
  const label = getShortcutLabel(shortcut)
  const parts = label.split('+')

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          <Kbd>{part.trim()}</Kbd>
          {i < parts.length - 1 && (
            <span className="text-[10px] text-muted-foreground/50">+</span>
          )}
        </span>
      ))}
    </div>
  )
}
