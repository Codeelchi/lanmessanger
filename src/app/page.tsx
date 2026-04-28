'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore, type ChatUser, type ChatRoom, type ChatMessage } from '@/lib/chat-store'
import { RoomList } from '@/components/chat/room-list'
import { ChatArea } from '@/components/chat/chat-area'
import { UserInfoPanel } from '@/components/chat/user-info-panel'
import { OnlineUsersPanel } from '@/components/chat/online-users-panel'
import { UserSettingsDialog } from '@/components/chat/user-settings-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  MessageSquare,
  Circle,
  Radio,
  Zap,
  Shield,
  Keyboard,
} from 'lucide-react'
import { playMessageSound, playJoinSound } from '@/lib/sounds'
import { KeyboardShortcutsDialog } from '@/components/chat/keyboard-shortcuts-dialog'
import { requestNotificationPermission, showNotification, isDesktopNotificationsEnabled } from '@/lib/notifications'
import { ThemeProvider } from 'next-themes'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { getInitials, getStatusColor } from '@/lib/chat-helpers'
import { useLANUsers, type LANUser } from '@/hooks/use-lan-users'

// ==================== USERNAME SETUP SCREEN ====================
function SetupScreen({ onJoin, isConnecting }: { onJoin: (username: string, displayName: string, status: string) => void; isConnecting: boolean }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'online' | 'away' | 'busy'>('online')
  const [formVisible, setFormVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setFormVisible(true), 150)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      onJoin(username.trim(), displayName.trim() || username.trim(), status)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-violet-50/30 to-blue-50 dark:from-gray-950 dark:via-indigo-950/20 dark:to-gray-950 relative overflow-hidden">
      {/* Decorative background orbs with parallax layers */}
      <div className="absolute top-1/4 -left-24 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl animate-float orb-parallax-slow" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-1/4 -right-24 w-96 h-96 bg-violet-400/15 dark:bg-violet-500/8 rounded-full blur-3xl animate-float orb-parallax-medium" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-3xl orb-parallax-fast" />

      {/* Animated floating particles (CSS only) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="particle-1 absolute top-[15%] left-[10%] h-2 w-2 rounded-full bg-indigo-400/40 dark:bg-indigo-400/20" />
        <div className="particle-2 absolute top-[25%] right-[15%] h-3 w-3 rounded-full bg-violet-400/30 dark:bg-violet-400/15" />
        <div className="particle-3 absolute bottom-[30%] left-[20%] h-1.5 w-1.5 rounded-full bg-blue-400/35 dark:bg-blue-400/18" />
        <div className="particle-4 absolute top-[60%] right-[25%] h-2.5 w-2.5 rounded-full bg-indigo-300/25 dark:bg-indigo-300/12" />
        <div className="particle-5 absolute bottom-[15%] left-[45%] h-2 w-2 rounded-full bg-violet-300/30 dark:bg-violet-300/15" />
        <div className="particle-2 absolute top-[45%] left-[60%] h-1.5 w-1.5 rounded-full bg-indigo-400/20 dark:bg-indigo-400/10" style={{ animationDelay: '3s' }} />
        <div className="particle-3 absolute bottom-[50%] right-[10%] h-2 w-2 rounded-full bg-violet-400/25 dark:bg-violet-400/12" style={{ animationDelay: '5s' }} />
        <div className="particle-1 absolute top-[75%] left-[35%] h-1 w-1 rounded-full bg-blue-400/30 dark:bg-blue-400/15" style={{ animationDelay: '2s' }} />
      </div>

      {/* Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <div className="flex items-center gap-1.5 glass border border-white/20 dark:border-white/10 rounded-full px-3.5 py-1.5 shadow-lg shadow-black/5 dark:shadow-black/20 backdrop-blur-xl">
          <span className={`h-2 w-2 rounded-full ${!isConnecting ? 'bg-indigo-500 shadow-sm shadow-indigo-500/50 animate-glow-pulse' : 'bg-gray-400 animate-connection-pulse'}`} />
          <span className="text-[11px] text-muted-foreground font-medium">
            {!isConnecting ? 'Ready' : 'Loading...'}
          </span>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-2xl shadow-indigo-500/8 shadow-violet-500/5 border border-white/60 dark:border-indigo-900/40 glass-subtle animate-scale-in relative overflow-hidden ring-1 ring-inset ring-white/40 dark:ring-indigo-400/10">
        {/* Pattern overlay on card */}
        <div className="absolute inset-0 rounded-[inherit] pattern-overlay pointer-events-none" />

        <CardHeader className="text-center pb-2 relative">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/15 animate-float">
            <MessageSquare className="h-8 w-8 text-white drop-shadow-sm" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-700 via-violet-600 to-indigo-600 dark:from-indigo-400 dark:via-violet-300 dark:to-indigo-400 bg-clip-text text-transparent animate-gradient-text">
            LAN Chat
          </CardTitle>
          <p className="text-sm text-muted-foreground/80 mt-1.5 animate-typing-cursor">
            Lightweight team messaging for your network
            <span className="animate-gradient-text bg-gradient-to-r from-indigo-600 via-violet-500 to-blue-500 dark:from-indigo-400 dark:via-violet-300 dark:to-blue-400 bg-clip-text text-transparent">.</span>
            <span className="animate-gradient-text bg-gradient-to-r from-violet-500 via-indigo-600 to-violet-500 dark:from-violet-300 dark:via-indigo-400 dark:to-violet-300 bg-clip-text text-transparent">.</span>
            <span className="animate-gradient-text bg-gradient-to-r from-blue-500 via-violet-500 to-indigo-600 dark:from-blue-400 dark:via-violet-300 dark:to-indigo-400 bg-clip-text text-transparent">.</span>
          </p>
        </CardHeader>
        <CardContent className="relative">
          <form onSubmit={handleSubmit} className={`space-y-4 transition-all duration-500 ${formVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-medium">Username *</Label>
              <Input
                id="username"
                placeholder="Enter a unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                required
                className="rounded-xl h-12 border-border/60 bg-muted/30 focus-visible:bg-background focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/20 transition-all text-sm shadow-sm focus-visible:shadow-md focus-visible:shadow-indigo-500/5"
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs font-medium">Display Name</Label>
              <Input
                id="displayName"
                placeholder="How others see you (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl h-12 border-border/60 bg-muted/30 focus-visible:bg-background focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/20 transition-all text-sm shadow-sm focus-visible:shadow-md focus-visible:shadow-indigo-500/5"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                {(['online', 'away', 'busy'] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={status === s ? 'default' : 'outline'}
                    className={`flex-1 capitalize text-sm rounded-xl transition-all duration-200 ${
                      status === s
                        ? s === 'online'
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/25'
                          : s === 'away'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/25'
                          : 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/25'
                        : 'hover:bg-muted/80'
                    }`}
                    onClick={() => setStatus(s)}
                  >
                    <Circle className={`h-3 w-3 mr-1.5 fill-current ${getStatusColor(s)}`} />
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl h-11 transition-all duration-200 shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 disabled:opacity-50 disabled:shadow-none animate-shine-effect"
              disabled={!username.trim() || isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Join Chat'}
            </Button>

            <div className="flex items-center justify-center gap-5 text-[10px] text-muted-foreground/70 pt-3">
              <span className="flex items-center gap-1.5 animate-subtle-pulse">
                <div className="h-5 w-5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Shield className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                </div>
                End-to-end
              </span>
              <span className="flex items-center gap-1.5 animate-subtle-pulse stagger-2">
                <div className="h-5 w-5 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                Real-time
              </span>
              <span className="flex items-center gap-1.5 animate-subtle-pulse stagger-3">
                <div className="h-5 w-5 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Radio className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                </div>
                LAN Ready
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== MAIN CHAT APP ====================
function ChatApp() {
  const {
    currentUser,
    users,
    rooms,
    activeRoom,
    messages,
    typingUsers,
    isConnected,
    setCurrentUser,
    addUser,
    removeUser,
    updateUserStatus,
    setUsers,
    setRooms,
    addRoom,
    setActiveRoom,
    addMessage,
    updateMessage,
    deleteMessage,
    setMessages,
    setTyping,
    clearTyping,
    setConnected,
    setUnreadCounts,
    markMessageRead,
    setPinnedMessage,
    removePinnedMessage,
    updateRoom,
    updateMessageReactions,
    setHasMoreMessages,
    reset,
  } = useChatStore()

  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [showOnlineUsers, setShowOnlineUsers] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showDMPicker, setShowDMPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sseRef = useRef<EventSource | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const connectSSERef = useRef<(userId: string, username: string) => void>(() => {})

  // LAN user discovery
  const { lanUsers, isBridgeRunning, isLoading: isLANLoading, refetch: refetchLAN } = useLANUsers(!!currentUser)

  // Load unread counts from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lanchat-unread')
      if (saved) {
        const counts = JSON.parse(saved) as Record<string, number>
        const map = new Map<string, number>()
        Object.entries(counts).forEach(([k, v]) => map.set(k, v))
        setUnreadCounts(map)
      }
    } catch {}
  }, [setUnreadCounts])

  // SSE connection (defined first to avoid reference-before-declaration)
  const connectSSE = useCallback((userId: string, username: string) => {
    // Close existing connection
    if (sseRef.current) {
      sseRef.current.close()
    }

    const es = new EventSource(`/api/chat/events?userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`)

    es.addEventListener('connected', () => {
      setConnected(true)
      setIsConnecting(false)
      console.log('SSE connected')
    })

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const { event: eventName, data } = payload

        switch (eventName) {
          case 'message': {
            const msg: ChatMessage = data
            addMessage(msg)
            const currentUserId = useChatStore.getState().currentUser?.id
            if (msg.sender && msg.sender.id !== currentUserId) {
              playMessageSound()
              // Show toast notification for messages in non-active rooms
              if (msg.roomId !== useChatStore.getState().activeRoom) {
                const room = useChatStore.getState().rooms.find(r => r.id === msg.roomId)
                const roomName = room?.name || 'New message'
                toast(`${roomName}: ${msg.sender?.displayName || 'Someone'}`, {
                  description: msg.content?.slice(0, 100) || '📎 File',
                  action: { label: 'View', onClick: () => useChatStore.getState().setActiveRoom(msg.roomId) },
                })
              }
              // Show desktop notification when tab is hidden
              if (document.hidden && isDesktopNotificationsEnabled()) {
                const senderName = msg.sender.displayName || msg.sender.username || 'Someone'
                showNotification(senderName, {
                  body: msg.content || (msg.fileUrl ? `📎 ${msg.fileName || 'File'}` : 'Sent a message'),
                  tag: `lanchat-${msg.roomId}`,
                })
              }
            }
            break
          }
          case 'user-joined': {
            if (data.user) {
              addUser(data.user as ChatUser)
              const currentUserId = useChatStore.getState().currentUser?.id
              if (data.user.id !== currentUserId) {
                playJoinSound()
              }
            }
            break
          }
          case 'user-left': {
            if (data.userId) {
              removeUser(data.userId)
            }
            break
          }
          case 'user-status-changed': {
            if (data.userId && data.status) {
              updateUserStatus(data.userId, data.status)
            }
            // Also handle statusMessage
            if (data.userId && data.statusMessage !== undefined) {
              const storeUsers = useChatStore.getState().users
              const user = storeUsers.get(data.userId)
              if (user) {
                const updatedUsers = new Map(storeUsers)
                updatedUsers.set(data.userId, { ...user, statusMessage: data.statusMessage || undefined } as ChatUser)
                useChatStore.setState({ users: updatedUsers })
              }
            }
            // Also handle customStatus (sent as part of statusMessage if starts with emoji)
            if (data.userId && data.statusMessage) {
              const storeUsers = useChatStore.getState().users
              const user = storeUsers.get(data.userId)
              if (user) {
                const isCustomStatus = /^\p{Emoji_Presentation}/u.test(data.statusMessage)
                if (isCustomStatus) {
                  const updatedUsers = new Map(storeUsers)
                  updatedUsers.set(data.userId, { ...user, customStatus: data.statusMessage } as ChatUser)
                  useChatStore.setState({ users: updatedUsers })
                }
              }
              // Update currentUser if this is us
              if (data.userId === useChatStore.getState().currentUser?.id) {
                const isCustomStatus = /^\p{Emoji_Presentation}/u.test(data.statusMessage)
                if (isCustomStatus) {
                  useChatStore.getState().setCustomStatus(data.statusMessage)
                }
              }
            } else if (data.userId && data.statusMessage === '') {
              // Cleared status
              const storeUsers = useChatStore.getState().users
              const user = storeUsers.get(data.userId)
              if (user?.customStatus) {
                const updatedUsers = new Map(storeUsers)
                updatedUsers.set(data.userId, { ...user, customStatus: undefined } as ChatUser)
                useChatStore.setState({ users: updatedUsers })
              }
              if (data.userId === useChatStore.getState().currentUser?.id) {
                useChatStore.getState().setCustomStatus(undefined)
              }
            }
            break
          }
          case 'room-created': {
            if (data.room) {
              addRoom(data.room as ChatRoom)
            }
            break
          }
          case 'user-typing': {
            if (data.roomId && data.userId) {
              setTyping(data.roomId, data.userId)
            }
            break
          }
          case 'message-edited': {
            if (data.id && data.roomId) {
              updateMessage(data.roomId, data.id, {
                content: data.content,
                editedAt: data.editedAt,
              })
            }
            break
          }
          case 'message-deleted': {
            if (data.id && data.roomId) {
              deleteMessage(data.roomId, data.id)
            }
            break
          }
          case 'message-read': {
            if (data.roomId && data.userId && data.lastMessageId) {
              markMessageRead(data.roomId, data.lastMessageId, data.userId)
            }
            break
          }
          case 'message-pinned': {
            if (data.roomId && data.message) {
              const pinMsg: ChatMessage = {
                id: data.message.id,
                roomId: data.roomId,
                sender: data.message.sender ? { ...data.message.sender, avatar: '', status: 'online' } : null,
                content: data.message.content,
                type: 'text',
                fileUrl: '',
                fileName: '',
                fileType: '',
                status: 'sent',
                timestamp: data.message.timestamp || new Date().toISOString(),
              }
              setPinnedMessage(data.roomId, pinMsg, data.pinnedBy)
            }
            break
          }
          case 'message-unpinned': {
            if (data.roomId) {
              removePinnedMessage(data.roomId)
            }
            break
          }
          case 'room-updated': {
            if (data.room) {
              updateRoom(data.room as ChatRoom)
            }
            break
          }
          case 'reaction-added': {
            if (data.messageId && data.roomId && data.reactions) {
              const currentUserId = useChatStore.getState().currentUser?.id
              const reactions = data.reactions.map((r: { emoji: string; count: number; userIds: string[] }) => ({
                emoji: r.emoji,
                count: r.count,
                reacted: currentUserId ? r.userIds.includes(currentUserId) : false,
              }))
              updateMessageReactions(data.roomId, data.messageId, reactions)
            }
            break
          }
          case 'reaction-removed': {
            if (data.messageId && data.roomId && data.reactions) {
              const currentUserId = useChatStore.getState().currentUser?.id
              const reactions = data.reactions.map((r: { emoji: string; count: number; userIds: string[] }) => ({
                emoji: r.emoji,
                count: r.count,
                reacted: currentUserId ? r.userIds.includes(currentUserId) : false,
              }))
              updateMessageReactions(data.roomId, data.messageId, reactions)
            }
            break
          }
          // ===== LAN Bridge Events =====
          case 'lan-user-discovered': {
            // New LAN user discovered — refresh LAN user list
            refetchLAN()
            break
          }
          case 'lan-user-left': {
            // LAN user departed — refresh and notify
            refetchLAN()
            if (data.userName) {
              toast(`${data.userName} went offline`, {
                description: 'LAN user disconnected',
                icon: '📶',
              })
            }
            break
          }
          case 'lan-user-status': {
            // LAN user changed status — refresh
            refetchLAN()
            break
          }
          case 'lan-user-renamed': {
            // LAN user changed their display name
            refetchLAN()
            if (data.oldName && data.newName) {
              toast(`LAN user renamed`, {
                description: `${data.oldName} → ${data.newName}`,
                icon: '✏️',
              })
            }
            break
          }
          case 'lan-user-note': {
            // LAN user changed their status message
            refetchLAN()
            break
          }
          case 'lan-user-typing': {
            // LAN user is typing — show in the DM room
            if (data.userId && data.state === 'composing') {
              // Find the LAN DM room for this user
              const store = useChatStore.getState()
              const lanDmRoom = store.rooms.find(r => r.name === `LAN: ${data.userName}`)
              if (lanDmRoom) {
                setTyping(lanDmRoom.id, `lan-${data.userId}`)
              }
            }
            break
          }
          case 'lan-user-avatar': {
            // LAN user updated their avatar
            refetchLAN()
            break
          }
          case 'lan-message-acknowledged': {
            // A message sent to LAN was delivered
            break
          }
          case 'lan-message-failed': {
            // A message sent to LAN failed
            toast('Message delivery failed', {
              description: `Could not deliver to LAN user: ${data.reason || 'Unknown error'}`,
              icon: '⚠️',
            })
            break
          }
        }
      } catch (e) {
        // Ignore parse errors for keepalive comments
      }
    }

    es.onerror = () => {
      console.log('SSE error, reconnecting...')
      if (es.readyState === EventSource.CLOSED) {
        setConnected(false)
        setTimeout(() => {
          const user = useChatStore.getState().currentUser
          if (user) {
            connectSSERef.current(user.id, user.username)
          }
        }, 3000)
      }
    }

    sseRef.current = es
  }, [addMessage, addUser, removeUser, updateUserStatus, addRoom, updateRoom, setTyping, setConnected, updateMessage, deleteMessage, markMessageRead, setPinnedMessage, removePinnedMessage, updateMessageReactions, refetchLAN])

  // Keep ref updated for self-reference in error handler
  useEffect(() => {
    connectSSERef.current = connectSSE
  }, [connectSSE])

  // Handle join
  const handleJoin = useCallback(async (username: string, displayName: string, status: string) => {
    setIsConnecting(true)

    try {
      const res = await fetch('/api/chat/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, status }),
      })

      const result = await res.json()

      if (result.success) {
        const { user, users: allUsers, rooms: userRooms } = result.data

        // Save to localStorage
        localStorage.setItem('lanchat-user', JSON.stringify({ username, displayName, status, userId: user.id }))

        // Set current user
        setCurrentUser({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar || '',
          status: user.status,
          lastSeen: user.lastSeen,
        })

        // Set users and rooms
        setUsers(allUsers)
        setRooms(userRooms)

        // Connect SSE
        connectSSE(user.id, user.username)

        // Request notification permission
        requestNotificationPermission().catch(() => {})

        // Sync status message from localStorage
        try {
          const savedCustomStatus = localStorage.getItem('lanchat-custom-status')
          if (savedCustomStatus) {
            // Set on current user locally
            setCurrentUser({ ...useChatStore.getState().currentUser!, customStatus: savedCustomStatus })
            // Sync to server
            fetch('/api/chat/status-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, statusMessage: savedCustomStatus }),
            }).catch(() => {})
          }
        } catch {}
      } else {
        console.error('Join failed:', result.error)
        setIsConnecting(false)
      }
    } catch (error) {
      console.error('Join error:', error)
      setIsConnecting(false)
    }
  }, [setCurrentUser, setUsers, setRooms, connectSSE])

  // Handle room selection
  const handleSelectRoom = useCallback(
    (roomId: string) => {
      setActiveRoom(roomId)
      setMobileShowChat(true)

      // Load history if not already loaded
      const currentMessages = messages.get(roomId)
      if (!currentMessages || currentMessages.length === 0) {
        fetch(`/api/chat/rooms/${roomId}/messages?limit=50`)
          .then((res) => res.json())
          .then((result) => {
            if (result.success && result.data.messages) {
              // Compute 'reacted' from userIds for each message's reactions
              const currentUserId = useChatStore.getState().currentUser?.id
              const processedMessages = result.data.messages.map((msg: Record<string, unknown>) => {
                if (msg.reactions && Array.isArray(msg.reactions) && currentUserId) {
                  return {
                    ...msg,
                    reactions: msg.reactions.map((r: { emoji: string; count: number; userIds: string[] }) => ({
                      emoji: r.emoji,
                      count: r.count,
                      reacted: r.userIds.includes(currentUserId),
                    })),
                  }
                }
                return { ...msg, reactions: [] }
              })
              setMessages(roomId, processedMessages)
              // Track hasMore from initial load
              if (result.data.hasMore !== undefined) {
                setHasMoreMessages(roomId, result.data.hasMore)
              }
            }
          })
          .catch(console.error)
      }
    },
    [setActiveRoom, messages, setMessages, setHasMoreMessages]
  )

  // Handle send message
  const handleSendMessage = useCallback(
    (roomId: string, content: string, type: 'private' | 'group' | 'broadcast' = 'group', recipientUsername?: string, replyToId?: string) => {
      if (!currentUser || !content.trim()) return

      // Detect if this is a LAN DM room (name starts with "LAN: ")
      const room = rooms.find((r) => r.id === roomId)
      const isLanRoom = room?.name?.startsWith('LAN: ') || false

      if (isLanRoom && room?.members) {
        // Find the LAN user in this room
        const lanMember = room.members.find((m) => m.user?.username?.startsWith('lan-'))
        if (lanMember?.user?.username) {
          // Extract LAN user ID from username (e.g., "lan-2CF05DD2CD79Roser" → "2CF05DD2CD79Roser")
          const lanUserId = lanMember.user.username.replace(/^lan-/, '')
          if (lanUserId) {
            fetch('/api/chat/send-to-lan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                senderId: currentUser.id,
                lanUserId,
                content: content.trim(),
                roomId,
              }),
            })
              .then((res) => res.json())
              .then((result) => {
                if (!result.success) {
                  toast.error('Message not delivered to LAN user', {
                    description: result.error || 'Unknown error',
                  })
                }
              })
              .catch(() => {
                toast.error('Failed to send to LAN user')
              })

            // Optimistically add message
            const optimisticMsg: ChatMessage = {
              id: `temp-${Date.now()}`,
              roomId,
              sender: currentUser,
              content: content.trim(),
              type: 'text',
              fileUrl: '',
              fileName: '',
              fileType: '',
              status: 'sent',
              timestamp: new Date().toISOString(),
              replyTo: replyToId ? null : undefined,
            }
            addMessage(optimisticMsg)
            return
          }
        }
      }

      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          type,
          recipientUsername,
          roomId,
          content: content.trim(),
          replyToId,
        }),
      }).catch(console.error)

      // If this is a broadcast room, also send to LAN network
      if (room?.type === 'broadcast') {
        fetch('/api/chat/lan-broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentUser.id,
            content: content.trim(),
          }),
        }).catch(() => {}) // Don't block on LAN broadcast failure
      }

      // Optimistically add message
      const optimisticMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        roomId,
        sender: currentUser,
        content: content.trim(),
        type: 'text',
        fileUrl: '',
        fileName: '',
        fileType: '',
        status: 'sent',
        timestamp: new Date().toISOString(),
        replyTo: replyToId ? null : undefined,
      }
      addMessage(optimisticMsg)
    },
    [currentUser, addMessage, rooms]
  )

  // Handle send file message
  const handleSendFile = useCallback(
    (roomId: string, file: { fileUrl: string; fileName: string; fileType: string; fileSize: number; isImage: boolean }, content?: string, type: 'private' | 'group' | 'broadcast' = 'group', recipientUsername?: string, replyToId?: string) => {
      if (!currentUser) return

      const isImage = file.isImage || file.fileType === 'image'
      const messageType = isImage ? 'text' : 'file'

      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          type,
          recipientUsername,
          roomId,
          content: content || '',
          fileUrl: file.fileUrl,
          fileName: file.fileName,
          fileType: file.fileType,
          replyToId,
        }),
      }).catch(console.error)

      // Optimistically add message
      const optimisticMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        roomId,
        sender: currentUser,
        content: content || '',
        type: messageType as 'text' | 'file',
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileType: file.fileType,
        status: 'sent',
        timestamp: new Date().toISOString(),
        replyTo: replyToId ? null : undefined,
      }
      addMessage(optimisticMsg)
    },
    [currentUser, addMessage]
  )

  // Handle send voice message
  const handleSendVoice = useCallback(
    (roomId: string, recording: { blob: Blob; duration: number; base64: string }, type: 'private' | 'group' | 'broadcast' = 'group', recipientUsername?: string, replyToId?: string) => {
      if (!currentUser) return

      // Upload the voice file first
      const extension = 'webm'
      const fileName = `voice_${recording.duration}s.${extension}`

      const blob = recording.blob
      const formData = new FormData()
      formData.append('file', blob, fileName)

      fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            const fileUrl = result.data.fileUrl
            fetch('/api/chat/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                senderId: currentUser.id,
                type,
                recipientUsername,
                roomId,
                content: '',
                fileUrl,
                fileName: result.data.fileName || fileName,
                fileType: 'audio',
                replyToId,
              }),
            }).catch(console.error)

            const optimisticMsg: ChatMessage = {
              id: `temp-${Date.now()}`,
              roomId,
              sender: currentUser,
              content: '',
              type: 'file',
              fileUrl,
              fileName: result.data.fileName || fileName,
              fileType: 'audio',
              status: 'sent',
              timestamp: new Date().toISOString(),
              replyTo: replyToId ? null : undefined,
            }
            addMessage(optimisticMsg)
          }
        })
        .catch(console.error)
    },
    [currentUser, addMessage]
  )

  // Handle typing — also sends chatstate to LAN users in DM rooms
  const handleTyping = useCallback(
    (roomId: string) => {
      if (!currentUser) return

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

      fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          roomId,
        }),
      }).catch(() => {})

      // If typing in a LAN DM room, send chatstate to the LAN user
      const room = useChatStore.getState().rooms.find(r => r.id === roomId)
      if (room?.name?.startsWith('LAN: ') && room?.members) {
        const lanMember = room.members.find(m => m.user?.username?.startsWith('lan-'))
        if (lanMember?.user?.username) {
          const lanUserId = lanMember.user.username.replace(/^lan-/, '')
          if (lanUserId) {
            fetch('/api/chat/lan-chatstate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lanUserId, command: 'chatstate', state: 'composing' }),
            }).catch(() => {})
          }
        }
      }

      typingTimeoutRef.current = setTimeout(() => {
        // Stop typing after 3s of no activity
      }, 3000)
    },
    [currentUser]
  )

  // Handle edit message
  const handleEditMessage = useCallback(
    (roomId: string, messageId: string, newContent: string, senderId: string) => {
      if (!currentUser) return

      fetch('/api/chat/edit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          newContent,
          senderId,
        }),
      }).catch(console.error)
    },
    [currentUser]
  )

  // Handle delete message
  const handleDeleteMessage = useCallback(
    (roomId: string, messageId: string, senderId: string) => {
      fetch('/api/chat/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          senderId,
        }),
      }).catch(console.error)
    },
    []
  )

  // Handle mark read
  const handleMarkRead = useCallback(
    (roomId: string, userId: string, lastMessageId: string) => {
      fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId,
          lastMessageId,
        }),
      }).catch(() => {})
    },
    []
  )

  // Handle create group
  const handleCreateGroup = useCallback(
    async (name: string, memberIds: string[], description?: string) => {
      if (!currentUser) return

      // Get usernames from memberIds
      const usernamePromises = memberIds.map(async (id) => {
        const user = users.get(id)
        if (user) return user.username
        // Fetch from API
        try {
          const res = await fetch('/api/chat/users')
          const result = await res.json()
          if (result.success) {
            const found = result.data.users.find((u: any) => u.id === id)
            return found?.username
          }
        } catch {}
        return null
      })

      const usernames = (await Promise.all(usernamePromises)).filter(Boolean) as string[]

      try {
        const res = await fetch('/api/chat/create-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId: currentUser.id,
            name,
            memberUsernames: usernames,
            description: description || '',
          }),
        })

        const result = await res.json()
        if (result.success) {
          addRoom(result.data.room)
        }
      } catch (error) {
        console.error('Create group error:', error)
      }
    },
    [currentUser, users, addRoom]
  )

  // Handle status update — also syncs to LAN
  const handleUpdateStatus = useCallback(
    async (status: string) => {
      if (!currentUser) return

      try {
        await fetch('/api/chat/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, status }),
        })

        // Sync status to LAN network
        fetch('/api/chat/lan-status-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, displayName: currentUser.displayName }),
        }).catch(() => {}) // Don't block on LAN sync failure

        setCurrentUser({ ...currentUser, status })
        localStorage.setItem(
          'lanchat-user',
          JSON.stringify({ username: currentUser.username, displayName: currentUser.displayName, status, userId: currentUser.id })
        )
      } catch (error) {
        console.error('Status update error:', error)
      }
    },
    [currentUser, setCurrentUser]
  )

  // Handle logout
  const handleLogout = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    localStorage.removeItem('lanchat-user')
    reset()
  }, [reset])

  // Handle update profile — also syncs display name to LAN
  const handleUpdateProfile = useCallback(
    async (userId: string, displayName: string) => {
      try {
        const res = await fetch('/api/chat/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, displayName }),
        })
        const result = await res.json()
        if (result.success) {
          const user = useChatStore.getState().currentUser
          if (user) {
            const updatedUser = { ...user, displayName }
            setCurrentUser(updatedUser)
            localStorage.setItem(
              'lanchat-user',
              JSON.stringify({
                username: user.username,
                displayName,
                status: user.status,
                userId: user.id,
              })
            )
          }
          // Sync display name to LAN network
          fetch('/api/chat/lan-status-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName }),
          }).catch(() => {})
        }
      } catch (error) {
        console.error('Update profile error:', error)
      }
    },
    [setCurrentUser]
  )

  // Handle pin message
  const handlePinMessage = useCallback(
    (message: ChatMessage) => {
      if (!currentUser) return
      fetch('/api/chat/pin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          roomId: message.roomId,
          userId: currentUser.id,
          messageContent: message.content,
          senderName: message.sender?.displayName || message.sender?.username || 'Unknown',
          senderId: message.sender?.id || null,
          timestamp: message.timestamp,
        }),
      }).catch(console.error)
    },
    [currentUser]
  )

  // Handle unpin message
  const handleUnpinMessage = useCallback(
    (roomId: string) => {
      fetch('/api/chat/unpin-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      }).catch(console.error)
    },
    []
  )

  // Handle bookmark message
  const handleBookmarkMessage = useCallback(
    (message: ChatMessage) => {
      if (!currentUser) return
      const bookmarkedMessageIds = useChatStore.getState().bookmarkedMessageIds
      const isBookmarked = bookmarkedMessageIds.has(message.id)
      useChatStore.getState().toggleBookmark(message.id)
      fetch('/api/chat/bookmark-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          messageId: message.id,
          action: isBookmarked ? 'unbookmark' : 'bookmark',
        }),
      }).catch(console.error)
    },
    [currentUser]
  )

  // Handle forward message
  const handleForwardMessage = useCallback(
    (targetRoomId: string, message: ChatMessage) => {
      if (!currentUser) return
      const senderName = message.sender?.displayName || message.sender?.username || 'Unknown'
      const forwardedContent = message.fileUrl
        ? `📎 ${message.fileName || 'File'} (forwarded from ${senderName})`
        : `Forwarded from ${senderName}: ${message.content}`
      handleSendMessage(targetRoomId, forwardedContent)
    },
    [currentUser, handleSendMessage]
  )

  const handleUpdateStatusMessage = useCallback(
    async (userId: string, statusMessage: string) => {
      try {
        await fetch('/api/chat/status-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, statusMessage }),
        })

        // Sync note/status message to LAN network
        fetch('/api/chat/lan-status-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: statusMessage }),
        }).catch(() => {})
      } catch (error) {
        console.error('Update status message error:', error)
      }
    },
    []
  )

  // Handle set custom status
  const handleSetCustomStatus = useCallback(
    (status: string) => {
      if (!currentUser) return
      // Save to localStorage
      localStorage.setItem('lanchat-custom-status', status)
      // Update local state
      useChatStore.getState().setCustomStatus(status)
      // Send via status-message API
      handleUpdateStatusMessage(currentUser.id, status)
    },
    [currentUser, handleUpdateStatusMessage]
  )

  // Handle clear custom status
  const handleClearCustomStatus = useCallback(
    () => {
      if (!currentUser) return
      localStorage.removeItem('lanchat-custom-status')
      useChatStore.getState().setCustomStatus(undefined)
      handleUpdateStatusMessage(currentUser.id, '')
    },
    [currentUser, handleUpdateStatusMessage]
  )

  // Handle edit room
  const handleEditRoom = useCallback(
    async (roomId: string, updates: { name?: string; description?: string }) => {
      if (!currentUser) return
      try {
        await fetch('/api/chat/edit-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, userId: currentUser.id, ...updates }),
        })
      } catch (error) {
        console.error('Edit room error:', error)
      }
    },
    [currentUser]
  )

  // Handle open private chat
  const handleOpenPrivateChat = useCallback(
    (userId: string) => {
      const targetUser = users.get(userId)
      if (!targetUser || !currentUser) return

      // Check if private room exists
      const existingRoom = rooms.find(
        (r) =>
          r.type === 'private' &&
          r.members?.some((m) => m.userId === userId)
      )

      if (existingRoom) {
        setActiveRoom(existingRoom.id)
        setMobileShowChat(true)
      } else {
        // Create a new private room via the API
        fetch('/api/chat/create-group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId: currentUser.id,
            name: `DM with ${targetUser.displayName || targetUser.username}`,
            memberUsernames: [targetUser.username],
            description: '',
          }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              addRoom(result.data.room)
              setActiveRoom(result.data.room.id)
              setMobileShowChat(true)
            }
          })
          .catch(console.error)
      }
    },
    [users, currentUser, rooms, setActiveRoom, setMobileShowChat, addRoom]
  )

  // Handle LAN user click — open or create a DM room with the LAN user
  // Also sends our userdata to the LAN user so they see our display name
  const handleLANUserClick = useCallback(
    (lanUser: LANUser) => {
      if (!currentUser) return

      // Send our profile data to the LAN user
      fetch('/api/chat/lan-chatstate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lanUserId: lanUser.id, command: 'userdata' }),
      }).catch(() => {})

      // Check if we already have a room with this LAN user
      // Match by checking if room is a private LAN room for this user
      const existingRoom = rooms.find(
        (r) =>
          r.type === 'private' &&
          (r.name === `LAN: ${lanUser.name}` || r.name === `LAN: ${lanUser.id}`) &&
          r.members?.some((m) => m.user?.username === `lan-${lanUser.id}`)
      )

      if (existingRoom) {
        setActiveRoom(existingRoom.id)
        setMobileShowChat(true)
      } else {
        // Create a new DM room via the send-to-lan API (content empty = room creation only)
        fetch('/api/chat/send-to-lan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentUser.id,
            lanUserId: lanUser.id,
            lanUserName: lanUser.name,
            content: '',
          }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.success && result.data?.roomId) {
              fetch('/api/chat/rooms')
                .then((r) => r.json())
                .then((rr) => {
                  if (rr.success) setRooms(rr.data.rooms)
                })
              setActiveRoom(result.data.roomId)
              setMobileShowChat(true)
            }
          })
          .catch(console.error)
      }
    },
    [currentUser, rooms, setActiveRoom, setMobileShowChat, setRooms]
  )

  // Handle user selection from online users panel
  const handleSelectUserFromPanel = useCallback(
    (userId: string) => {
      handleOpenPrivateChat(userId)
      setShowOnlineUsers(false)
    },
    [handleOpenPrivateChat]
  )

  // Auto-join on mount if credentials exist
  useEffect(() => {
    const saved = localStorage.getItem('lanchat-user')
    if (saved) {
      try {
        const { username, displayName, status } = JSON.parse(saved)
        if (username) {
          const timer = setTimeout(() => {
            handleJoin(username, displayName || username, status || 'online')
          }, 500)
          return () => clearTimeout(timer)
        }
      } catch {}
    }
  }, [handleJoin])

  // Cleanup typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      typingUsers.forEach((roomMap, roomId) => {
        roomMap.forEach((ts, userId) => {
          if (now - ts > 5000) {
            clearTyping(roomId, userId)
          }
        })
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [typingUsers, clearTyping])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close()
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
    }
  }, [])

  // ==================== KEYBOARD SHORTCUTS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // --- Shortcuts that work even in inputs ---

      // Escape: close dialogs, cancel edit/reply, or go back on mobile
      if (e.key === 'Escape') {
        e.preventDefault()
        const store = useChatStore.getState()
        if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false)
        } else if (store.editingMessage) {
          store.setEditingMessage(null)
        } else if (store.replyingTo) {
          store.setReplyingTo(null)
        } else if (mobileShowChat) {
          setMobileShowChat(false)
        }
        return
      }

      // Shift+?: show keyboard shortcuts (works everywhere)
      if (e.shiftKey && e.key === '?') {
        e.preventDefault()
        setShowKeyboardShortcuts((prev) => !prev)
        return
      }

      // --- Shortcuts that require no input focus (except message input) ---
      // Allow shortcuts when message textarea is focused (for enter/shift+enter handling by component itself)
      // but block other single-key shortcuts when any input is focused

      // Ctrl/Cmd + N: New conversation / DM picker
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setShowDMPicker(true)
        return
      }

      // Ctrl/Cmd + K: Search messages
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('lanchat:open-search'))
        return
      }

      // Ctrl/Cmd + B: Toggle sidebar (desktop only)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        // Only effective on desktop (md+)
        if (window.innerWidth >= 768) {
          setSidebarCollapsed((prev) => !prev)
        }
        return
      }

      // Don't handle single-key shortcuts when any input is focused
      if (isInputFocused) return

      // e: Edit last sent message
      if (e.key === 'e') {
        e.preventDefault()
        const store = useChatStore.getState()
        if (store.activeRoom && store.currentUser) {
          const roomMessages = store.messages.get(store.activeRoom) || []
          const myLastMsg = [...roomMessages].reverse().find(
            (m) => m.sender?.id === store.currentUser?.id && !m.deletedAt
          )
          if (myLastMsg) {
            store.setEditingMessage(myLastMsg)
          }
        }
        return
      }

      // r: Reply to last message
      if (e.key === 'r') {
        e.preventDefault()
        const store = useChatStore.getState()
        if (store.activeRoom) {
          const roomMessages = store.messages.get(store.activeRoom) || []
          const lastMsg = roomMessages[roomMessages.length - 1]
          if (lastMsg && lastMsg.sender?.id !== store.currentUser?.id) {
            store.setReplyingTo(lastMsg)
          }
        }
        return
      }

      // .: Toggle theme
      if (e.key === '.') {
        e.preventDefault()
        const isDark = document.documentElement.classList.contains('dark')
        document.documentElement.classList.toggle('dark', !isDark)
        localStorage.setItem('lanchat-theme', isDark ? 'light' : 'dark')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showKeyboardShortcuts, mobileShowChat])

  // If no user yet, show setup
  if (!currentUser) {
    return <SetupScreen onJoin={handleJoin} isConnecting={isConnecting} />
  }

  const activeRoomData = rooms.find((r) => r.id === activeRoom)

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div className={`hidden md:flex transition-all duration-300 ease-in-out overflow-hidden ${sidebarCollapsed ? 'w-0' : ''}`}>
          <RoomList
            currentUser={currentUser}
            rooms={rooms}
            users={users}
            activeRoom={activeRoom}
            isConnected={isConnected}
            onSelectRoom={handleSelectRoom}
            onCreateGroup={handleCreateGroup}
            onUpdateStatus={handleUpdateStatus}
            onLogout={handleLogout}
            onSelectUser={handleSelectUserFromPanel}
            onShowOnlineUsers={() => { setShowOnlineUsers(true); setShowInfoPanel(false) }}
            onOpenSettings={() => setShowSettings(true)}
            onSetCustomStatus={handleSetCustomStatus}
            onClearCustomStatus={handleClearCustomStatus}
            lanUsers={lanUsers}
            isBridgeRunning={isBridgeRunning}
            isLANLoading={isLANLoading}
            onRefreshLAN={refetchLAN}
            onLANUserClick={handleLANUserClick}
          />
        </div>

        {/* Chat Area */}
        <ChatArea
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onMarkRead={handleMarkRead}
          onPinMessage={handlePinMessage}
          onUnpinMessage={handleUnpinMessage}
          onBookmarkMessage={handleBookmarkMessage}
          onSendFile={handleSendFile}
          onSendVoice={handleSendVoice}
          onForwardMessage={handleForwardMessage}
          onToggleInfo={() => { setShowInfoPanel(!showInfoPanel); setShowOnlineUsers(false) }}
        />

        {/* Info Panel */}
        {showInfoPanel && (
          <div className="w-72 border-l bg-muted/20 animate-slide-in-right">
            <UserInfoPanel
              room={activeRoomData || null}
              users={users}
              currentUser={currentUser}
              messages={messages}
              onAddMember={() => {}}
              onLeaveGroup={() => {}}
              onOpenPrivateChat={handleOpenPrivateChat}
              onEditRoom={handleEditRoom}
            />
          </div>
        )}

        {/* Online Users Panel (Desktop) */}
        {showOnlineUsers && !showInfoPanel && (
          <OnlineUsersPanel
            users={users}
            currentUser={currentUser}
            onSelectUser={handleSelectUserFromPanel}
            open={true}
            onOpenChange={setShowOnlineUsers}
            lanUsers={lanUsers}
            isBridgeRunning={isBridgeRunning}
            onLANUserClick={handleLANUserClick}
          />
        )}
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-1 overflow-hidden pt-12 relative">
        {/* Room List - slides left when hidden */}
        <div className={`absolute inset-0 overflow-hidden transition-transform duration-300 ease-out ${mobileShowChat ? '-translate-x-full' : 'translate-x-0'}`}>
          <RoomList
            currentUser={currentUser}
            rooms={rooms}
            users={users}
            activeRoom={activeRoom}
            isConnected={isConnected}
            onSelectRoom={handleSelectRoom}
            onCreateGroup={handleCreateGroup}
            onUpdateStatus={handleUpdateStatus}
            onLogout={handleLogout}
            onSelectUser={handleSelectUserFromPanel}
            onOpenSettings={() => setShowSettings(true)}
            onSetCustomStatus={handleSetCustomStatus}
            onClearCustomStatus={handleClearCustomStatus}
            lanUsers={lanUsers}
            isBridgeRunning={isBridgeRunning}
            isLANLoading={isLANLoading}
            onRefreshLAN={refetchLAN}
            onLANUserClick={handleLANUserClick}
          />
        </div>

        {/* Chat Area - slides in from right when visible */}
        <div className={`absolute inset-0 overflow-hidden transition-transform duration-300 ease-out ${mobileShowChat ? 'translate-x-0' : 'translate-x-full'}`}>
          <ChatArea
            onBack={() => setMobileShowChat(false)}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onMarkRead={handleMarkRead}
            onPinMessage={handlePinMessage}
            onUnpinMessage={handleUnpinMessage}
            onBookmarkMessage={handleBookmarkMessage}
            onSendFile={handleSendFile}
            onSendVoice={handleSendVoice}
            onForwardMessage={handleForwardMessage}
            onToggleInfo={() => {}}
          />

          {/* Mobile FAB for info / online users */}
          <div className="fixed bottom-20 right-4 flex gap-2 z-50">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg transition-all duration-150"
                  size="icon"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <UserInfoPanel
                  room={activeRoomData || null}
                  users={users}
                  currentUser={currentUser}
                  messages={messages}
                  onOpenPrivateChat={handleOpenPrivateChat}
                  onEditRoom={handleEditRoom}
                />
              </SheetContent>
            </Sheet>
          </div>

          {/* Online Users Panel (Mobile Sheet) */}
          <OnlineUsersPanel
            users={users}
            currentUser={currentUser}
            onSelectUser={handleSelectUserFromPanel}
            open={showOnlineUsers}
            onOpenChange={setShowOnlineUsers}
            lanUsers={lanUsers}
            isBridgeRunning={isBridgeRunning}
            onLANUserClick={handleLANUserClick}
          />
        </div>
      </div>

      {/* User Settings Dialog */}
      <UserSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onUpdateStatusMessage={handleUpdateStatusMessage}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
      />

      {/* Keyboard Shortcut Button - Desktop */}
      <button
        onClick={() => setShowKeyboardShortcuts(true)}
        className="hidden md:flex fixed bottom-3 left-3 z-30 items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/60 border border-border/40 hover:border-border/70 transition-all duration-200 group shadow-sm"
        title="Keyboard Shortcuts"
      >
        <Keyboard className="h-3.5 w-3.5 group-hover:text-indigo-500 transition-colors" />
        <span>Shortcuts</span>
        <kbd className="ml-1 px-1 py-0.5 rounded bg-muted/80 border border-border/50 text-[9px] font-mono">?</kbd>
      </button>

      {/* Keyboard Shortcut Button - Mobile */}
      <button
        onClick={() => setShowKeyboardShortcuts(true)}
        className="md:hidden fixed bottom-3 left-3 z-30 flex items-center justify-center h-9 w-9 rounded-full bg-muted/80 border border-border/40 hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200 group shadow-sm"
        title="Keyboard Shortcuts"
      >
        <Keyboard className="h-4 w-4 text-muted-foreground/70 group-hover:text-indigo-500 transition-colors" />
      </button>
    </div>
  )
}

// ==================== CONNECTION STATUS BAR ====================
function ConnectionStatusBar() {
  const isConnected = useChatStore((s) => s.isConnected)
  const currentUser = useChatStore((s) => s.currentUser)

  if (!currentUser) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] h-[3px] transition-all duration-500 ${
      isConnected
        ? 'bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500'
        : 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 animate-pulse'
    }`} />
  )
}

// ==================== WRAPPER WITH THEME PROVIDER ====================
export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ConnectionStatusBar />
      <ChatApp />
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  )
}
