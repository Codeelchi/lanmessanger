// Shared helper functions for chat components
// Extracted from duplicated implementations across room-list, chat-area,
// chat-message, message-search, forward-dialog, user-info-panel,
// online-users-panel, and page.tsx

/**
 * Get initials from a display name (max 2 characters).
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Get a deterministic avatar color class based on the name hash.
 * Uses 6 colors with full light/dark mode text styling.
 */
export function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

/**
 * Get a Tailwind background color class for a user status dot.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'bg-emerald-500'
    case 'away': return 'bg-amber-400'
    case 'busy': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
}

/**
 * Get a human-readable label for a room type.
 */
export function getRoomTypeLabel(type: string): string {
  switch (type) {
    case 'private': return 'DM'
    case 'group': return 'Group'
    case 'broadcast': return 'Broadcast'
    default: return 'Chat'
  }
}

/**
 * Format a last-seen timestamp into a human-readable relative string.
 */
export function formatLastSeen(lastSeen: string | Date): string {
  const date = new Date(lastSeen)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
