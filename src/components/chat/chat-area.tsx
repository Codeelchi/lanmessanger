'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Users, Radio, MessageSquare, WifiOff, RefreshCw, ShieldCheck, Zap, UsersRound, Search, Pin, X, Download, Loader2, ChevronUp } from 'lucide-react'
import { useChatStore, type ChatRoom, type ChatMessage } from '@/lib/chat-store'
import { playSendSound } from '@/lib/sounds'
import { getInitials, getAvatarColor, getStatusColor } from '@/lib/chat-helpers'
import { ChatMessage as ChatMessageBubble } from './chat-message'
import { MessageInput, type MessageInputHandle, type UploadedFile, type VoiceRecording } from './message-input'
import { MessageSearch } from './message-search'
import { ForwardDialog } from './forward-dialog'

interface ChatAreaProps {
  onBack?: () => void
  onSendMessage?: (roomId: string, content: string, type?: 'private' | 'group' | 'broadcast', recipientUsername?: string, replyToId?: string) => void
  onTyping?: (roomId: string) => void
  onEditMessage?: (roomId: string, messageId: string, newContent: string, senderId: string) => void
  onDeleteMessage?: (roomId: string, messageId: string, senderId: string) => void
  onMarkRead?: (roomId: string, userId: string, lastMessageId: string) => void
  onPinMessage?: (message: ChatMessage) => void
  onUnpinMessage?: (roomId: string) => void
  onBookmarkMessage?: (message: ChatMessage) => void
  onSendFile?: (roomId: string, file: UploadedFile, content?: string, type?: 'private' | 'group' | 'broadcast', recipientUsername?: string, replyToId?: string) => void
  onSendVoice?: (roomId: string, recording: VoiceRecording, type?: 'private' | 'group' | 'broadcast', recipientUsername?: string, replyToId?: string) => void
  onForwardMessage?: (targetRoomId: string, message: ChatMessage) => void
  onToggleInfo?: () => void
}

function getStatusText(status: string): string {
  switch (status) {
    case 'online': return 'Online'
    case 'away': return 'Away'
    case 'busy': return 'Do not disturb'
    default: return 'Offline'
  }
}

function formatDateSeparator(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function shouldShowDateSeparator(prev: ChatMessage | undefined, curr: ChatMessage): boolean {
  if (!prev) return true
  return new Date(prev.timestamp).toDateString() !== new Date(curr.timestamp).toDateString()
}

function isWithinGroupWindow(prev: ChatMessage | undefined, curr: ChatMessage): boolean {
  if (!prev) return false
  if (prev.type === 'system' || curr.type === 'system') return false
  if (prev.deletedAt || curr.deletedAt) return false
  if (prev.sender?.id !== curr.sender?.id) return false
  const diff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()
  return diff < 120000
}

export function ChatArea({ onBack, onSendMessage, onTyping, onEditMessage, onDeleteMessage, onMarkRead, onPinMessage, onUnpinMessage, onBookmarkMessage, onSendFile, onSendVoice, onForwardMessage, onToggleInfo }: ChatAreaProps) {
  const {
    currentUser,
    rooms,
    activeRoom,
    messages,
    typingUsers,
    users,
    isConnected,
    setActiveRoom,
    editingMessage,
    setEditingMessage,
    replyingTo,
    setReplyingTo,
    clearUnread,
    setLastReadMessageId,
    pinnedMessages,
    lastReadMessageIds,
    unreadCounts,
    hasMoreMessages,
    prependMessages,
    setHasMoreMessages,
  } = useChatStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const prevRoomRef = useRef<string | null>(null)
  const [roomTransitioning, setRoomTransitioning] = useState(false)
  const messageInputRef = useRef<MessageInputHandle>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [showForwardDialog, setShowForwardDialog] = useState(false)
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null)
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0)
  const [showUnreadBadge, setShowUnreadBadge] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Apply wallpaper from localStorage
  useEffect(() => {
    const container = document.getElementById('chat-messages-container')
    if (!container) return
    const applyWallpaper = () => {
      let wallpaper = 'default'
      try {
        wallpaper = localStorage.getItem('lanchat-wallpaper') || 'default'
      } catch {}
      // Remove all wallpaper classes
      container.classList.remove('chat-wallpaper-default', 'chat-wallpaper-dots', 'chat-wallpaper-gradient', 'chat-wallpaper-night', 'chat-wallpaper-mesh', 'chat-wallpaper-paper')
      // Add selected wallpaper class
      container.classList.add(`chat-wallpaper-${wallpaper}`)
    }
    applyWallpaper()
    window.addEventListener('lanchat:wallpaper-changed', applyWallpaper)
    return () => window.removeEventListener('lanchat:wallpaper-changed', applyWallpaper)
  }, [])

  const activeRoomData = useMemo(
    () => rooms.find((r) => r.id === activeRoom),
    [rooms, activeRoom]
  )

  const roomMessages = useMemo(
    () => (activeRoom ? messages.get(activeRoom) || [] : []),
    [messages, activeRoom]
  )

  const typingUserList = useMemo(() => {
    if (!activeRoom) return []
    const roomTyping = typingUsers.get(activeRoom)
    if (!roomTyping) return []
    const now = Date.now()
    return Array.from(roomTyping.entries())
      .filter(([, ts]) => now - ts < 5000)
      .map(([userId]) => userId)
      .filter((id) => id !== currentUser?.id)
  }, [typingUsers, activeRoom, currentUser?.id])

  const typingNames = useMemo(() => {
    return typingUserList.map((id) => {
      const user = users.get(id)
      return user?.displayName || user?.username || id
    })
  }, [typingUserList, users])

  // Mark messages as read when viewing a room
  useEffect(() => {
    if (activeRoom && currentUser && roomMessages.length > 0) {
      const lastMsg = roomMessages[roomMessages.length - 1]
      if (lastMsg && lastMsg.sender?.id !== currentUser.id) {
        // Clear unread
        clearUnread(activeRoom)
        setLastReadMessageId(activeRoom, lastMsg.id)

        // Notify server
        if (onMarkRead) {
          onMarkRead(activeRoom, currentUser.id, lastMsg.id)
        }
      }
    }
  }, [activeRoom, roomMessages.length, currentUser, clearUnread, setLastReadMessageId, onMarkRead])

  // Determine if room has more messages (default true until API says otherwise)
  const hasMore = activeRoom ? hasMoreMessages.get(activeRoom) ?? true : false

  // Load more messages handler
  const loadMoreMessages = useCallback(async () => {
    if (!activeRoom || loadingMore || !hasMore) return
    const currentMessages = messages.get(activeRoom) || []
    if (currentMessages.length === 0) return

    setLoadingMore(true)

    // Record current scroll height for position preservation
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    const prevScrollHeight = viewport?.scrollHeight || 0
    const prevScrollTop = viewport?.scrollTop || 0

    try {
      // Use the oldest message timestamp as the cursor
      const oldestTimestamp = currentMessages[0].timestamp
      const res = await fetch(
        `/api/chat/rooms/${activeRoom}/messages?limit=50&before=${encodeURIComponent(oldestTimestamp)}`
      )
      const json = await res.json()
      if (json.success && json.data) {
        const { messages: olderMessages, hasMore: newHasMore } = json.data
        if (olderMessages.length > 0) {
          // Compute 'reacted' from userIds for each message's reactions
          const currentUserId = useChatStore.getState().currentUser?.id
          const processedMessages = olderMessages.map((msg: Record<string, unknown>) => {
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
          prependMessages(activeRoom, processedMessages)
        }
        setHasMoreMessages(activeRoom, newHasMore)

        // Restore scroll position after prepend
        requestAnimationFrame(() => {
          if (viewport) {
            const newScrollHeight = viewport.scrollHeight
            const heightDiff = newScrollHeight - prevScrollHeight
            viewport.scrollTop = prevScrollTop + heightDiff
          }
        })
      }
    } catch (err) {
      console.error('[loadMoreMessages] Error:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [activeRoom, loadingMore, hasMore, messages, prependMessages, setHasMoreMessages])

  // Track scroll position for scroll-to-bottom button and auto-load-more
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      if (viewport) {
        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        setShowScrollToBottom(distanceFromBottom > 150)

        // Auto-trigger load more when scrolled near top
        if (viewport.scrollTop < 100 && hasMore && !loadingMore) {
          loadMoreMessages()
        }
      }
    }
  }, [hasMore, loadingMore, loadMoreMessages])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
      }
    }
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]')
      if (viewport) {
        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        if (distanceFromBottom < 150) {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
    }
  }, [roomMessages.length, typingUserList.length])

  // Room switch transition + unread badge animation
  useEffect(() => {
    if (activeRoom && activeRoom !== prevRoomRef.current) {
      prevRoomRef.current = activeRoom
      setRoomTransitioning(true)
      const timer = setTimeout(() => setRoomTransitioning(false), 200)

      // Show unread badge animation when switching to a room with unread messages
      const currentUnread = unreadCounts.get(activeRoom) || 0
      if (currentUnread > 0) {
        const showTimer = setTimeout(() => {
          setUnreadBadgeCount(currentUnread)
          setShowUnreadBadge(true)
        }, 0)
        const badgeTimer = setTimeout(() => setShowUnreadBadge(false), 2000)
        return () => {
          clearTimeout(timer)
          clearTimeout(showTimer)
          clearTimeout(badgeTimer)
        }
      }

      return () => clearTimeout(timer)
    }
  }, [activeRoom, unreadCounts])

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      if (!activeRoom || !activeRoomData) return

      if (editingMessage && onEditMessage) {
        // Handle edit
        onEditMessage(activeRoom, editingMessage.id, content, currentUser?.id || '')
        setEditingMessage(null)
        return
      }

      if (onSendMessage) {
        const type = activeRoomData.type
        let recipientUsername: string | undefined

        if (type === 'private') {
          const otherMember = activeRoomData.members?.find((m) => m.userId !== currentUser?.id)
          if (otherMember) {
            recipientUsername = otherMember.user.username
          }
        }

        onSendMessage(activeRoom, content, type as 'private' | 'group' | 'broadcast', recipientUsername, replyToId)

        // Clear reply state
        if (replyToId) {
          setReplyingTo(null)
        }
      }

      playSendSound()
    },
    [activeRoom, activeRoomData, currentUser?.id, onSendMessage, onEditMessage, editingMessage, setEditingMessage, setReplyingTo]
  )

  const handleInput = useCallback(
    () => {
      if (activeRoom && onTyping) {
        onTyping(activeRoom)
      }
    },
    [activeRoom, onTyping]
  )

  const handleSearchSelectRoom = useCallback(
    (roomId: string, messageId: string) => {
      setActiveRoom(roomId)
      setScrollToMessageId(messageId)
    },
    [setActiveRoom]
  )

  const handleEditMessage = useCallback((message: ChatMessage) => {
    if (message.deletedAt) return
    setReplyingTo(null)
    setEditingMessage(message)
    messageInputRef.current?.focus()
  }, [setEditingMessage, setReplyingTo])

  const handleReplyMessage = useCallback((message: ChatMessage) => {
    if (message.deletedAt) return
    setEditingMessage(null)
    setReplyingTo(message)
    messageInputRef.current?.focus()
  }, [setReplyingTo, setEditingMessage])

  const handleDeleteMessage = useCallback((message: ChatMessage) => {
    if (!onDeleteMessage || !currentUser) return
    onDeleteMessage(activeRoom || '', message.id, currentUser.id)
  }, [onDeleteMessage, currentUser, activeRoom])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
  }, [setEditingMessage])

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null)
  }, [setReplyingTo])

  const handleSendVoice = useCallback(
    (recording: VoiceRecording, replyToId?: string) => {
      if (!activeRoom || !activeRoomData || !onSendVoice) return
      const type = activeRoomData.type
      let recipientUsername: string | undefined
      if (type === 'private') {
        const otherMember = activeRoomData.members?.find((m) => m.userId !== currentUser?.id)
        if (otherMember) recipientUsername = otherMember.user.username
      }
      onSendVoice(activeRoom, recording, type as 'private' | 'group' | 'broadcast', recipientUsername, replyToId)
      if (replyToId) setReplyingTo(null)
      playSendSound()
    },
    [activeRoom, activeRoomData, currentUser?.id, onSendVoice, setReplyingTo]
  )

  const handleSendFile = useCallback(
    (file: UploadedFile, caption?: string, replyToId?: string) => {
      if (!activeRoom || !activeRoomData || !onSendFile) return

      const type = activeRoomData.type
      let recipientUsername: string | undefined

      if (type === 'private') {
        const otherMember = activeRoomData.members?.find((m) => m.userId !== currentUser?.id)
        if (otherMember) {
          recipientUsername = otherMember.user.username
        }
      }

      onSendFile(activeRoom, file, caption, type as 'private' | 'group' | 'broadcast', recipientUsername, replyToId)

      if (replyToId) {
        setReplyingTo(null)
      }

      playSendSound()
    },
    [activeRoom, activeRoomData, currentUser?.id, onSendFile, setReplyingTo]
  )

  const handleImageClick = useCallback((url: string) => {
    setLightboxUrl(url)
  }, [])

  const handleCloseLightbox = useCallback(() => {
    setLightboxUrl(null)
  }, [])

  const handlePinMessage = useCallback((message: ChatMessage) => {
    if (onPinMessage) {
      onPinMessage(message)
    }
  }, [onPinMessage])

  const handleBookmarkMessage = useCallback((message: ChatMessage) => {
    if (onBookmarkMessage) {
      onBookmarkMessage(message)
    }
  }, [onBookmarkMessage])

  const handleForwardMessage = useCallback((message: ChatMessage) => {
    setForwardMessage(message)
    setShowForwardDialog(true)
  }, [])

  const handleForwardToRoom = useCallback((targetRoomId: string, message: ChatMessage) => {
    if (onForwardMessage) {
      onForwardMessage(targetRoomId, message)
    }
  }, [onForwardMessage])

  const handleUnpinMessage = useCallback(() => {
    if (activeRoom && onUnpinMessage) {
      onUnpinMessage(activeRoom)
    }
  }, [activeRoom, onUnpinMessage])

  // Scroll to message when search selects one
  useEffect(() => {
    if (!scrollToMessageId || !activeRoom) return
    // Wait for messages to render after room switch
    const timer = setTimeout(() => {
      const msgEl = document.querySelector(`[data-message-id="${scrollToMessageId}"]`)
      if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        msgEl.classList.add('ring-2', 'ring-indigo-400', 'dark:ring-indigo-500')
        setTimeout(() => {
          msgEl.classList.remove('ring-2', 'ring-indigo-400', 'dark:ring-indigo-500')
        }, 2000)
      }
      setScrollToMessageId(null)
    }, 300)
    return () => clearTimeout(timer)
  }, [scrollToMessageId, activeRoom])

  // Keyboard support for lightbox
  useEffect(() => {
    if (!lightboxUrl) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseLightbox()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxUrl, handleCloseLightbox])

  const pinnedMessage = activeRoom ? pinnedMessages.get(activeRoom) : undefined

  // Unread badge animation element
  const unreadBadgeEl = showUnreadBadge && unreadBadgeCount > 0 ? (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-bounce-in">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/30">
        <span>{unreadBadgeCount}</span>
        <span>new</span>
      </div>
    </div>
  ) : null

  // Empty state - no room selected
  if (!activeRoomData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-muted/30 via-background to-muted/10 dark:from-muted/10 dark:via-background dark:to-muted/5 relative overflow-hidden">
        {/* Animated particle dots background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="empty-state-particle absolute top-[12%] left-[8%] h-1.5 w-1.5 rounded-full bg-indigo-400/30 dark:bg-indigo-400/15" style={{ '--duration': '10s', '--delay': '0s', '--drift-x': '25px', '--drift-y': '-35px' } as React.CSSProperties} />
          <div className="empty-state-particle absolute top-[22%] right-[12%] h-2 w-2 rounded-full bg-violet-400/25 dark:bg-violet-400/12" style={{ '--duration': '12s', '--delay': '2s', '--drift-x': '-20px', '--drift-y': '-28px' } as React.CSSProperties} />
          <div className="empty-state-particle absolute top-[45%] left-[15%] h-1 w-1 rounded-full bg-indigo-400/20 dark:bg-indigo-400/10" style={{ '--duration': '8s', '--delay': '4s', '--drift-x': '30px', '--drift-y': '-20px' } as React.CSSProperties} />
          <div className="empty-state-particle absolute bottom-[30%] right-[20%] h-2.5 w-2.5 rounded-full bg-blue-400/20 dark:bg-blue-400/10" style={{ '--duration': '11s', '--delay': '1s', '--drift-x': '-25px', '--drift-y': '-32px' } as React.CSSProperties} />
          <div className="empty-state-particle absolute top-[65%] left-[40%] h-1.5 w-1.5 rounded-full bg-violet-300/20 dark:bg-violet-300/10" style={{ '--duration': '9s', '--delay': '3s', '--drift-x': '18px', '--drift-y': '-25px' } as React.CSSProperties} />
          <div className="empty-state-particle absolute bottom-[20%] left-[25%] h-2 w-2 rounded-full bg-indigo-300/15 dark:bg-indigo-300/8" style={{ '--duration': '14s', '--delay': '5s', '--drift-x': '-22px', '--drift-y': '-30px' } as React.CSSProperties} />
        </div>

        {/* Main icon group with floating animation */}
        <div className="relative mb-8 animate-slide-up opacity-0 stagger-1">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20 dark:shadow-indigo-500/10 animate-float-bob">
            <MessageSquare className="h-14 w-14 text-white drop-shadow-sm" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-400/30 animate-slow-float-rotate">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-lg bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-400/30 animate-slow-float-rotate-2">
            <ShieldCheck className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Gradient heading with shimmer animation */}
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-700 via-violet-500 to-indigo-600 dark:from-indigo-400 dark:via-violet-300 dark:to-blue-400 bg-clip-text text-transparent animate-gradient-shimmer-text animate-slide-up opacity-0 stagger-2">
          Welcome to LAN Chat
        </h2>
        <p className="text-sm text-muted-foreground/80 text-center max-w-sm mb-10 leading-relaxed animate-slide-up opacity-0 stagger-3">
          Select a conversation from the sidebar to start messaging, or create a new group to collaborate with your team.
        </p>

        {/* Feature cards with staggered entrance */}
        <div className="flex items-center gap-8 text-xs text-muted-foreground">
          <div className="flex flex-col items-center gap-2 animate-slide-up opacity-0 stagger-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shadow-sm shadow-indigo-500/10 hover:shadow-md hover:shadow-indigo-500/20 transition-all duration-200">
              <ShieldCheck className="h-5.5 w-5.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="font-medium text-muted-foreground/70">Secure</span>
          </div>
          <div className="flex flex-col items-center gap-2 animate-slide-up opacity-0 stagger-5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shadow-sm shadow-amber-500/10 hover:shadow-md hover:shadow-amber-500/20 transition-all duration-200">
              <Zap className="h-5.5 w-5.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-medium text-muted-foreground/70">Real-time</span>
          </div>
          <div className="flex flex-col items-center gap-2 animate-slide-up opacity-0 stagger-6">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shadow-sm shadow-violet-500/10 hover:shadow-md hover:shadow-violet-500/20 transition-all duration-200">
              <UsersRound className="h-5.5 w-5.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="font-medium text-muted-foreground/70">Groups</span>
          </div>
        </div>
      </div>
    )
  }

  const roomName =
    activeRoomData.name ||
    (activeRoomData.type === 'private' && activeRoomData.members?.find((m) => m.userId !== currentUser?.id)?.user?.displayName) ||
    (activeRoomData.type === 'broadcast' ? 'Broadcast' : 'Group Chat')

  const otherUser =
    activeRoomData.type === 'private'
      ? activeRoomData.members?.find((m) => m.userId !== currentUser?.id)?.user
      : null

  const memberCount = activeRoomData.members?.length || 0

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Disconnect Banner */}
      {!isConnected && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center gap-2 text-xs">
          <WifiOff className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
          <span className="text-destructive font-medium">Disconnected</span>
          <span className="text-muted-foreground">— attempting to reconnect...</span>
          <div className="ml-auto flex items-center gap-1">
            <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-14 border-b border-border/20 px-4 flex items-center gap-3 glass-header gradient-border-bottom">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden rounded-lg hover:bg-muted/80" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {otherUser ? (
          <div className="relative">
            <Avatar className="h-9 w-9 ring-2 ring-background">
              <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(otherUser.displayName || otherUser.username)}`}>
                {getInitials(otherUser.displayName || otherUser.username)}
              </AvatarFallback>
            </Avatar>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(otherUser.status)}`} />
          </div>
        ) : activeRoomData.type === 'broadcast' ? (
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-400/20">
            <Radio className="h-4.5 w-4.5 text-white" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-400/20">
            <Users className="h-4.5 w-4.5 text-white" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {typingNames.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-recording-dot flex-shrink-0" />
            )}
            <h2 className="text-sm font-semibold truncate">{roomName}</h2>
            {activeRoomData.type === 'broadcast' ? (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-[10px] px-1.5 py-0 font-medium shadow-sm">
                <Radio className="h-2.5 w-2.5 mr-0.5" />
                Broadcast
              </Badge>
            ) : activeRoomData.type === 'group' ? (
              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-[10px] px-1.5 py-0 font-medium shadow-sm">
                <Users className="h-2.5 w-2.5 mr-0.5" />
                {memberCount}
              </Badge>
            ) : otherUser ? (
              <span className="text-[10px] text-muted-foreground">
                {getStatusText(otherUser.status)}
              </span>
            ) : null}
          </div>
          {/* Status message for DM / other user */}
          {otherUser?.statusMessage && (
            <p className="text-[10px] text-muted-foreground/60 italic truncate mt-0.5">
              {otherUser.statusMessage}
            </p>
          )}
          {/* Room description for groups */}
          {activeRoomData.type === 'group' && activeRoomData.description ? (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {activeRoomData.description}
            </p>
          ) : activeRoomData.type === 'group' && !activeRoomData.description ? (
            <p className="text-[10px] text-muted-foreground/40 italic mt-0.5">
              No topic set
            </p>
          ) : null}
        </div>

        {/* Search Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search messages</span>
        </Button>

        {/* Info Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80"
          onClick={() => onToggleInfo?.()}
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Info</span>
        </Button>
      </div>

      {/* Pinned Message Bar */}
      {pinnedMessage && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center gap-2 animate-fade-in cursor-pointer hover:bg-indigo-100/80 dark:hover:bg-indigo-900/30 transition-colors"
          onClick={() => {
            // Find and scroll to the pinned message
            const msgEl = document.querySelector(`[data-message-id="${pinnedMessage.message.id}"]`)
            if (msgEl) {
              msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
              msgEl.classList.add('ring-2', 'ring-indigo-400', 'dark:ring-indigo-500')
              setTimeout(() => {
                msgEl.classList.remove('ring-2', 'ring-indigo-400', 'dark:ring-indigo-500')
              }, 2000)
            }
          }}
        >
          <Pin className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Pinned by {pinnedMessage.pinnedBy}</p>
            <p className="text-xs text-foreground/80 truncate">
              <span className="font-medium">{pinnedMessage.message.sender?.displayName || pinnedMessage.message.sender?.username || 'Unknown'}:</span>{' '}
              {pinnedMessage.message.content}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleUnpinMessage()
            }}
            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-indigo-200/60 dark:hover:bg-indigo-800/40 transition-colors flex-shrink-0"
          >
            <X className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div id="chat-messages-container" className="relative flex-1 flex flex-col min-h-0" style={{ scrollBehavior: 'smooth' }}>
        {/* Top gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background via-background/80 to-transparent z-10 pointer-events-none" />
        {/* Bottom gradient overlay (above input) - smoother fade */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background via-background/90 to-transparent z-10 pointer-events-none" />

        {/* Unread badge animation */}
        {unreadBadgeEl}

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 h-9 w-9 rounded-full bg-background/90 dark:bg-card/90 border border-border/50 shadow-lg flex items-center justify-center hover:bg-background dark:hover:bg-card hover:shadow-xl transition-all duration-200 hover:scale-110 animate-scale-up"
            title="Scroll to bottom"
          >
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 13l5 5 5-5" />
              <path d="M7 6l5 5 5-5" />
            </svg>
          </button>
        )}

        <ScrollArea ref={scrollRef} className="flex-1 py-1 custom-scrollbar" onScrollCapture={handleScroll}>
        <div className={`max-w-4xl mx-auto ${roomTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
          {/* Load more button */}
          {hasMore && roomMessages.length > 0 && (
            <div className="flex justify-center py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMoreMessages}
                disabled={loadingMore}
                className="gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-200/50 dark:border-indigo-700/40 rounded-full px-4 h-8 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-300/60 dark:hover:border-indigo-600/50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Load earlier messages</span>
                  </>
                )}
              </Button>
            </div>
          )}
          {roomMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-muted/80 to-muted/40 dark:from-muted/40 dark:to-muted/20 flex items-center justify-center mb-5 shadow-inner animate-breathe animate-gradient">
                {activeRoomData.type === 'broadcast' ? (
                  <Radio className="h-9 w-9 text-muted-foreground/30" />
                ) : (
                  <MessageSquare className="h-9 w-9 text-muted-foreground/30" />
                )}
              </div>
              <p className="text-sm font-semibold text-muted-foreground/70 mb-1.5">
                No messages yet
              </p>
              <p className="text-xs text-muted-foreground/50">
                {activeRoomData.type === 'broadcast'
                  ? 'Be the first to broadcast a message!'
                  : `Send a message to start the conversation.`}
              </p>
            </div>
          ) : (
            roomMessages.map((msg, i) => {
              const prevMsg = i > 0 ? roomMessages[i - 1] : undefined
              const nextMsg = i < roomMessages.length - 1 ? roomMessages[i + 1] : undefined
              const showSeparator = shouldShowDateSeparator(prevMsg, msg)
              const isOwn = msg.sender?.id === currentUser?.id || !msg.sender
              const showSender = activeRoomData.type !== 'private' && msg.type !== 'system'
              const grouped = isWithinGroupWindow(prevMsg, msg) && !isOwn
              const isLastInGroup = !nextMsg || nextMsg.sender?.id !== msg.sender?.id || new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime() > 120000 || Boolean(nextMsg.deletedAt)

              // Check if this is the first message after the last read boundary
              const lastReadId = activeRoom ? lastReadMessageIds.get(activeRoom) : undefined
              const showNewMessagesDivider = !isOwn && !msg.deletedAt && msg.type !== 'system' && lastReadId && prevMsg && prevMsg.id === lastReadId && msg.id !== lastReadId

              return (
                <div key={msg.id}>
                  {showSeparator && (
                    <div className="flex items-center gap-3 my-4 px-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                      <span className="text-[11px] text-muted-foreground/60 font-medium px-3 py-1 bg-muted/50 dark:bg-muted/30 rounded-full shadow-sm">
                        {formatDateSeparator(msg.timestamp)}
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                    </div>
                  )}
                  {showNewMessagesDivider && (
                    <div className="flex items-center gap-3 my-3 px-4">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-full shadow-sm border border-indigo-200/50 dark:border-indigo-700/40">
                        New messages
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
                    </div>
                  )}
                  <ChatMessageBubble
                    message={msg}
                    isOwn={isOwn}
                    showSender={showSender}
                    isGrouped={grouped}
                    isLastInGroup={isLastInGroup}
                    roomMembersCount={memberCount}
                    onEdit={isOwn ? handleEditMessage : undefined}
                    onDelete={isOwn ? handleDeleteMessage : undefined}
                    onReply={handleReplyMessage}
                    onPin={msg.type !== 'system' && !msg.deletedAt ? handlePinMessage : undefined}
                    onBookmark={msg.type !== 'system' && !msg.deletedAt ? handleBookmarkMessage : undefined}
                    onForward={msg.type !== 'system' && !msg.deletedAt ? handleForwardMessage : undefined}
                    onImageClick={handleImageClick}
                  />
                </div>
              )
            })
          )}

          {/* Typing indicator */}
          {typingNames.length > 0 && (
            <div className="px-4 py-2 animate-fade-in">
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted/30 dark:bg-muted/20">
                <div className="flex gap-0.5 items-center h-3.5">
                  <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-indigo-500" style={{ animationDelay: '0ms' }} />
                  <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-indigo-500" style={{ animationDelay: '200ms' }} />
                  <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-indigo-500" style={{ animationDelay: '400ms' }} />
                </div>
                <span className="italic">
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing...`
                    : typingNames.length === 2
                    ? `${typingNames[0]} and ${typingNames[1]} are typing...`
                    : `${typingNames.length} people are typing...`}
                </span>
              </div>
            </div>
          )}
        </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <MessageInput
        ref={messageInputRef}
        onSend={handleSend}
        onSendFile={handleSendFile}
        onSendVoice={handleSendVoice}
        onInput={handleInput}
        disabled={!isConnected}
        editingMessage={editingMessage}
        replyingTo={replyingTo}
        onCancelEdit={handleCancelEdit}
        onCancelReply={handleCancelReply}
      />

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={handleCloseLightbox}
        >
          {/* Close button */}
          <button
            onClick={handleCloseLightbox}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all duration-200 z-10"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Download button */}
          <a
            href={lightboxUrl}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-16 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all duration-200 z-10"
          >
            <Download className="h-5 w-5" />
          </a>

          {/* Image */}
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Message Search Dialog */}
      <MessageSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        messages={messages}
        rooms={rooms}
        onSelectMessage={handleSearchSelectRoom}
      />

      {/* Forward Dialog */}
      <ForwardDialog
        open={showForwardDialog}
        onOpenChange={setShowForwardDialog}
        message={forwardMessage}
        rooms={rooms}
        currentUserId={currentUser?.id || ''}
        onForward={handleForwardToRoom}
      />
    </div>
  )
}
