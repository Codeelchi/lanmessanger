// Server-side event bus for real-time chat using Server-Sent Events
// This runs inside the Next.js process - no separate service needed

type EventCallback = (data: unknown) => void

interface Subscriber {
  userId: string
  username: string
  callback: EventCallback
  lastActive: number
}

export interface PinnedMessageEntry {
  message: {
    id: string
    roomId: string
    sender: { id: string; displayName: string; username: string } | null
    content: string
    type: string
    timestamp: string
  }
  pinnedBy: string
  pinnedAt: number
}

class ChatEventBus {
  private subscribers: Map<string, Subscriber> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private pinnedMessages: Map<string, PinnedMessageEntry> = new Map() // keyed by roomId

  constructor() {
    // Clean up stale connections every 30s
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      for (const [id, sub] of this.subscribers) {
        if (now - sub.lastActive > 60000) {
          this.subscribers.delete(id)
        }
      }
    }, 30000)
  }

  subscribe(id: string, userId: string, username: string, callback: EventCallback) {
    this.subscribers.set(id, { userId, username, callback, lastActive: Date.now() })
  }

  unsubscribe(id: string) {
    this.subscribers.delete(id)
  }

  touch(id: string) {
    const sub = this.subscribers.get(id)
    if (sub) sub.lastActive = Date.now()
  }

  getOnlineUsernames(): string[] {
    const usernames = new Set<string>()
    for (const sub of this.subscribers.values()) {
      usernames.add(sub.username)
    }
    return Array.from(usernames)
  }

  isUserOnline(username: string): boolean {
    for (const sub of this.subscribers.values()) {
      if (sub.username === username) return true
    }
    return false
  }

  emit(event: string, data: unknown, excludeUserId?: string) {
    const payload = JSON.stringify({ event, data })
    for (const [id, sub] of this.subscribers) {
      if (excludeUserId && sub.userId === excludeUserId) continue
      try {
        sub.callback(payload)
      } catch {
        this.subscribers.delete(id)
      }
    }
  }

  // ---- Pinned Messages ----
  pinMessage(roomId: string, message: PinnedMessageEntry['message'], pinnedBy: string): PinnedMessageEntry {
    const entry: PinnedMessageEntry = {
      message,
      pinnedBy,
      pinnedAt: Date.now(),
    }
    this.pinnedMessages.set(roomId, entry)
    return entry
  }

  unpinMessage(roomId: string): boolean {
    return this.pinnedMessages.delete(roomId)
  }

  getPinnedMessage(roomId: string): PinnedMessageEntry | undefined {
    return this.pinnedMessages.get(roomId)
  }

  // ---- Bookmarked Messages ----
  private bookmarkedMessages: Map<string, Set<string>> = new Map() // userId -> Set<messageId>

  bookmarkMessage(userId: string, messageId: string): boolean {
    const bookmarks = this.bookmarkedMessages.get(userId) || new Set<string>()
    if (bookmarks.has(messageId)) return false // already bookmarked
    bookmarks.add(messageId)
    this.bookmarkedMessages.set(userId, bookmarks)
    return true
  }

  unbookmarkMessage(userId: string, messageId: string): boolean {
    const bookmarks = this.bookmarkedMessages.get(userId)
    if (!bookmarks || !bookmarks.has(messageId)) return false
    bookmarks.delete(messageId)
    if (bookmarks.size === 0) {
      this.bookmarkedMessages.delete(userId)
    }
    return true
  }

  isBookmarked(userId: string, messageId: string): boolean {
    return this.bookmarkedMessages.get(userId)?.has(messageId) || false
  }

  getUserBookmarks(userId: string): string[] {
    return Array.from(this.bookmarkedMessages.get(userId) || [])
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    this.subscribers.clear()
  }
}

// Singleton instance
export const chatBus = new ChatEventBus()
