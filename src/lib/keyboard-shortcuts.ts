export interface KeyboardShortcut {
  key: string       // e.g. 'n', 'Escape', '/'
  ctrl?: boolean    // Ctrl/Cmd modifier
  shift?: boolean   // Shift modifier
  alt?: boolean     // Alt modifier
  description: string
  category: 'navigation' | 'messaging' | 'general'
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { key: 'n', ctrl: true, description: 'New conversation', category: 'navigation' },
  { key: 'k', ctrl: true, description: 'Search messages', category: 'navigation' },
  { key: 'Escape', description: 'Close dialog / Go back', category: 'navigation' },

  // Messaging
  { key: 'Enter', description: 'Send message', category: 'messaging' },
  { key: 'Enter', shift: true, description: 'New line in message', category: 'messaging' },
  { key: 'e', description: 'Edit last message', category: 'messaging' },
  { key: 'r', description: 'Reply to last message', category: 'messaging' },
  { key: 'f', description: 'Forward last message', category: 'messaging' },

  // General
  { key: '?', shift: true, description: 'Show keyboard shortcuts', category: 'general' },
  { key: 'b', ctrl: true, description: 'Toggle sidebar', category: 'general' },
  { key: '.', description: 'Toggle theme', category: 'general' },
]

export const CATEGORY_LABELS: Record<KeyboardShortcut['category'], string> = {
  navigation: 'Navigation',
  messaging: 'Messaging',
  general: 'General',
}

export function getShortcutLabel(shortcut: KeyboardShortcut): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push(isMac() ? '⌘' : 'Ctrl')
  if (shortcut.shift) parts.push(isMac() ? '⇧' : 'Shift')
  if (shortcut.alt) parts.push(isMac() ? '⌥' : 'Alt')
  parts.push(shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase())
  return parts.join('+')
}

export function getModifierBadge(key: string): string {
  switch (key.toLowerCase()) {
    case 'ctrl': return isMac() ? '⌘' : 'Ctrl'
    case 'shift': return isMac() ? '⇧' : 'Shift'
    case 'alt': return isMac() ? '⌥' : 'Alt'
    default: return key
  }
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
}
