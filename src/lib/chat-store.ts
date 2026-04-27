import { create } from 'zustand'

export interface ChatUser {
  id: string
  username: string
  displayName: string
  avatar: string
  status: string
  lastSeen?: string
  statusMessage?: string
  customStatus?: string // e.g., "☕ Coffee break", "🎮 Gaming", "📝 Working"
}

export interface ChatMessage {
  id: string
  roomId: string
  sender: ChatUser | null
  content: string
  type: 'text' | 'system' | 'file'
  fileUrl: string
  fileName: string
  fileType: string
  status: string
  timestamp: string
  editedAt?: string | null
  deletedAt?: string | null
  replyTo?: {
    id: string
    content: string
    sender: ChatUser | null
    deletedAt?: string | null
  } | null
  readBy?: string[]
  reactions?: MessageReactionInfo[]
}

export interface MessageReactionInfo {
  emoji: string
  count: number
  reacted: boolean
}

export interface RoomMember {
  userId: string
  role: string
  joinedAt: string
  user: ChatUser
}

export interface ChatRoom {
  id: string
  name: string
  type: 'private' | 'group' | 'broadcast'
  avatar: string
  description: string
  createdAt: string
  updatedAt: string
  members?: RoomMember[]
  lastMessage?: ChatMessage | null
}

export interface PinnedMessage {
  message: ChatMessage
  pinnedBy: string
}

interface ChatState {
  currentUser: ChatUser | null
  users: Map<string, ChatUser>
  rooms: ChatRoom[]
  activeRoom: string | null
  messages: Map<string, ChatMessage[]>
  typingUsers: Map<string, Map<string, number>> // roomId -> userId -> timestamp
  unreadCounts: Map<string, number> // roomId -> count
  lastReadMessageIds: Map<string, string> // roomId -> messageId
  pinnedMessages: Map<string, PinnedMessage> // roomId -> pinned info
  bookmarkedMessageIds: Set<string> // Set of bookmarked message IDs
  hasMoreMessages: Map<string, boolean> // roomId -> whether more messages exist
  editingMessage: ChatMessage | null
  replyingTo: ChatMessage | null
  isConnected: boolean

  setCurrentUser: (user: ChatUser | null) => void
  addUser: (user: ChatUser) => void
  removeUser: (userId: string) => void
  updateUserStatus: (userId: string, status: string) => void
  updateUserCustomStatus: (userId: string, customStatus?: string) => void
  setCustomStatus: (customStatus?: string) => void
  setUsers: (users: ChatUser[]) => void
  setRooms: (rooms: ChatRoom[]) => void
  addRoom: (room: ChatRoom) => void
  updateRoom: (room: ChatRoom) => void
  removeRoom: (roomId: string) => void
  setActiveRoom: (roomId: string | null) => void
  addMessage: (message: ChatMessage) => void
  setMessages: (roomId: string, messages: ChatMessage[]) => void
  updateMessage: (roomId: string, messageId: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (roomId: string, messageId: string) => void
  setTyping: (roomId: string, userId: string) => void
  clearTyping: (roomId: string, userId: string) => void
  setConnected: (connected: boolean) => void
  incrementUnread: (roomId: string) => void
  clearUnread: (roomId: string) => void
  setUnreadCounts: (counts: Map<string, number>) => void
  setLastReadMessageId: (roomId: string, messageId: string) => void
  setEditingMessage: (message: ChatMessage | null) => void
  setReplyingTo: (message: ChatMessage | null) => void
  markMessageRead: (roomId: string, messageId: string, userId: string) => void
  setPinnedMessage: (roomId: string, message: ChatMessage, pinnedBy: string) => void
  removePinnedMessage: (roomId: string) => void
  toggleBookmark: (messageId: string) => void
  updateMessageReactions: (roomId: string, messageId: string, reactions: MessageReactionInfo[]) => void
  prependMessages: (roomId: string, newMessages: ChatMessage[]) => void
  setHasMoreMessages: (roomId: string, hasMore: boolean) => void
  reset: () => void
}

const initialState = {
  currentUser: null,
  users: new Map<string, ChatUser>(),
  rooms: [] as ChatRoom[],
  activeRoom: null as string | null,
  messages: new Map<string, ChatMessage[]>(),
  typingUsers: new Map<string, Map<string, number>>(),
  unreadCounts: new Map<string, number>(),
  lastReadMessageIds: new Map<string, string>(),
  pinnedMessages: new Map<string, PinnedMessage>(),
  bookmarkedMessageIds: new Set<string>(),
  hasMoreMessages: new Map<string, boolean>(),
  editingMessage: null as ChatMessage | null,
  replyingTo: null as ChatMessage | null,
  isConnected: false,
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setCurrentUser: (user) => set({ currentUser: user }),

  addUser: (user) =>
    set((state) => {
      const users = new Map(state.users)
      users.set(user.id, user)
      return { users }
    }),

  removeUser: (userId) =>
    set((state) => {
      const users = new Map(state.users)
      const user = users.get(userId)
      if (user) {
        users.set(userId, { ...user, status: 'offline' })
      }
      return { users }
    }),

  updateUserStatus: (userId, status) =>
    set((state) => {
      const users = new Map(state.users)
      const user = users.get(userId)
      if (user) {
        users.set(userId, { ...user, status })
      }
      return { users }
    }),

  updateUserCustomStatus: (userId, customStatus) =>
    set((state) => {
      const users = new Map(state.users)
      const user = users.get(userId)
      if (user) {
        users.set(userId, { ...user, customStatus })
      }
      // Also update currentUser if it's the same user
      if (state.currentUser?.id === userId) {
        return { users, currentUser: { ...state.currentUser, customStatus } }
      }
      return { users }
    }),

  setCustomStatus: (customStatus) =>
    set((state) => {
      if (!state.currentUser) return state
      return { currentUser: { ...state.currentUser, customStatus } }
    }),

  setUsers: (users) =>
    set(() => {
      const userMap = new Map<string, ChatUser>()
      users.forEach((u) => userMap.set(u.id, u))
      return { users: userMap }
    }),

  setRooms: (rooms) => set({ rooms }),

  addRoom: (room) =>
    set((state) => {
      const exists = state.rooms.find((r) => r.id === room.id)
      if (exists) {
        return {
          rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
        }
      }
      return { rooms: [room, ...state.rooms] }
    }),

  updateRoom: (room) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
    })),

  removeRoom: (roomId) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      activeRoom: state.activeRoom === roomId ? null : state.activeRoom,
    })),

  setActiveRoom: (roomId) => set({ activeRoom: roomId }),

  addMessage: (message) =>
    set((state) => {
      const messages = new Map(state.messages)
      const roomMessages = messages.get(message.roomId) || []
      // Deduplicate: replace temp message if real message arrives for same content+sender+timestamp
      const existingIdx = roomMessages.findIndex(
        (m) => m.id.startsWith('temp-') &&
          m.roomId === message.roomId &&
          m.sender?.id === message.sender?.id &&
          m.content === message.content &&
          Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 5000
      )
      const updatedMessages = [...roomMessages]
      if (existingIdx >= 0) {
        // Replace temp message with real one
        updatedMessages[existingIdx] = message
      } else {
        updatedMessages.push(message)
      }
      // Sort by timestamp
      updatedMessages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      messages.set(message.roomId, updatedMessages)

      // Update lastMessage on the room
      const rooms = state.rooms.map((r) =>
        r.id === message.roomId ? { ...r, lastMessage: message } : r
      )

      // Increment unread if message not from current user and room is not active
      const unreadCounts = new Map(state.unreadCounts)
      if (
        message.sender &&
        message.sender.id !== state.currentUser?.id &&
        state.activeRoom !== message.roomId
      ) {
        unreadCounts.set(message.roomId, (unreadCounts.get(message.roomId) || 0) + 1)
      }

      // Save unread counts to localStorage
      try {
        const obj: Record<string, number> = {}
        unreadCounts.forEach((v, k) => { obj[k] = v })
        localStorage.setItem('lanchat-unread', JSON.stringify(obj))
      } catch {}

      return { messages, rooms, unreadCounts }
    }),

  setMessages: (roomId, msgs) =>
    set((state) => {
      const messages = new Map(state.messages)
      const existing = messages.get(roomId) || []
      // Merge, avoiding duplicates by id
      const existingIds = new Set(existing.map((m) => m.id))
      const merged = [...existing, ...msgs.filter((m) => !existingIds.has(m.id))]
      merged.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      messages.set(roomId, merged)
      return { messages }
    }),

  updateMessage: (roomId, messageId, updates) =>
    set((state) => {
      const messages = new Map(state.messages)
      const roomMessages = (messages.get(roomId) || []).map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      )
      messages.set(roomId, roomMessages)

      // Update lastMessage if it's the one being edited
      const rooms = state.rooms.map((r) => {
        if (r.id === roomId && r.lastMessage?.id === messageId) {
          return { ...r, lastMessage: { ...r.lastMessage, ...updates } }
        }
        return r
      })

      return { messages, rooms }
    }),

  deleteMessage: (roomId, messageId) =>
    set((state) => {
      const messages = new Map(state.messages)
      const roomMessages = (messages.get(roomId) || []).map((m) =>
        m.id === messageId
          ? { ...m, content: 'This message was deleted', deletedAt: new Date().toISOString() }
          : m
      )
      messages.set(roomId, roomMessages)
      return { messages }
    }),

  setTyping: (roomId, userId) =>
    set((state) => {
      const typingUsers = new Map(state.typingUsers)
      const roomTyping = new Map(typingUsers.get(roomId) ?? new Map<string, number>())
      roomTyping.set(userId, Date.now())
      typingUsers.set(roomId, roomTyping)
      return { typingUsers }
    }),

  clearTyping: (roomId, userId) =>
    set((state) => {
      const typingUsers = new Map(state.typingUsers)
      const roomTyping = new Map(typingUsers.get(roomId) ?? new Map<string, number>())
      roomTyping.delete(userId)
      if (roomTyping.size === 0) {
        typingUsers.delete(roomId)
      } else {
        typingUsers.set(roomId, roomTyping)
      }
      return { typingUsers }
    }),

  setConnected: (connected) => set({ isConnected: connected }),

  incrementUnread: (roomId) =>
    set((state) => {
      const unreadCounts = new Map(state.unreadCounts)
      unreadCounts.set(roomId, (unreadCounts.get(roomId) || 0) + 1)
      try {
        const obj: Record<string, number> = {}
        unreadCounts.forEach((v, k) => { obj[k] = v })
        localStorage.setItem('lanchat-unread', JSON.stringify(obj))
      } catch {}
      return { unreadCounts }
    }),

  clearUnread: (roomId) =>
    set((state) => {
      const unreadCounts = new Map(state.unreadCounts)
      unreadCounts.delete(roomId)
      try {
        const obj: Record<string, number> = {}
        unreadCounts.forEach((v, k) => { obj[k] = v })
        localStorage.setItem('lanchat-unread', JSON.stringify(obj))
      } catch {}
      return { unreadCounts }
    }),

  setUnreadCounts: (counts) => set({ unreadCounts: counts }),

  setLastReadMessageId: (roomId, messageId) =>
    set((state) => {
      const lastReadMessageIds = new Map(state.lastReadMessageIds)
      lastReadMessageIds.set(roomId, messageId)
      try {
        const obj: Record<string, string> = {}
        lastReadMessageIds.forEach((v, k) => { obj[k] = v })
        localStorage.setItem('lanchat-lastread', JSON.stringify(obj))
      } catch {}
      return { lastReadMessageIds }
    }),

  setEditingMessage: (message) => set({ editingMessage: message }),

  setReplyingTo: (message) => set({ replyingTo: message }),

  markMessageRead: (roomId, messageId, userId) =>
    set((state) => {
      const messages = new Map(state.messages)
      const roomMessages = (messages.get(roomId) || []).map((m) => {
        if (m.id === messageId) {
          const readBy = new Set(m.readBy || [])
          readBy.add(userId)
          return { ...m, readBy: Array.from(readBy) }
        }
        return m
      })
      messages.set(roomId, roomMessages)
      return { messages }
    }),

  setPinnedMessage: (roomId, message, pinnedBy) =>
    set((state) => {
      const pinnedMessages = new Map(state.pinnedMessages)
      pinnedMessages.set(roomId, { message, pinnedBy })
      return { pinnedMessages }
    }),

  removePinnedMessage: (roomId) =>
    set((state) => {
      const pinnedMessages = new Map(state.pinnedMessages)
      pinnedMessages.delete(roomId)
      return { pinnedMessages }
    }),

  toggleBookmark: (messageId) =>
    set((state) => {
      const bookmarkedMessageIds = new Set(state.bookmarkedMessageIds)
      if (bookmarkedMessageIds.has(messageId)) {
        bookmarkedMessageIds.delete(messageId)
      } else {
        bookmarkedMessageIds.add(messageId)
      }
      return { bookmarkedMessageIds }
    }),

  updateMessageReactions: (roomId, messageId, reactions) =>
    set((state) => {
      const messages = new Map(state.messages)
      const roomMessages = (messages.get(roomId) || []).map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      )
      messages.set(roomId, roomMessages)
      return { messages }
    }),

  prependMessages: (roomId, newMessages) =>
    set((state) => {
      const messages = new Map(state.messages)
      const existing = messages.get(roomId) || []
      const existingIds = new Set(existing.map((m) => m.id))
      const unique = newMessages.filter((m) => !existingIds.has(m.id))
      if (unique.length === 0) return state
      const merged = [...unique, ...existing]
      merged.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      messages.set(roomId, merged)
      return { messages }
    }),

  setHasMoreMessages: (roomId, hasMore) =>
    set((state) => {
      const hasMoreMessages = new Map(state.hasMoreMessages)
      hasMoreMessages.set(roomId, hasMore)
      return { hasMoreMessages }
    }),

  reset: () => set(initialState),
}))
