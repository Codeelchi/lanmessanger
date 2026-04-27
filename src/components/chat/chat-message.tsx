'use client'

import { useState, useCallback, useRef, type CSSProperties } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pencil, Trash2, Reply, Copy, Check, CheckCheck, Pin, ArrowRightLeft, PencilLine, Bookmark, BookmarkCheck, MoreHorizontal } from 'lucide-react'
import { type ChatMessage as ChatMessageType, type MessageReactionInfo, type ChatUser } from '@/lib/chat-store'
import { useChatStore } from '@/lib/chat-store'
import { getInitials, getAvatarColor, getStatusColor } from '@/lib/chat-helpers'
import { FilePreview } from './file-preview'
import { extractLinks } from '@/lib/utils'
import { UserProfilePopover } from './user-profile-popover'
import { toast } from 'sonner'

// ---- Quick reaction emojis ----
const QUICK_REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🙏', label: 'Thanks' },
]

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

// ---- Render Message Content with Link Detection ----
function RenderMessageContent({ content, isOwn }: { content: string; isOwn: boolean }) {
  const links = extractLinks(content)
  if (links.length === 0) {
    return <>{content}</>
  }

  // Build parts array: alternating between text and link segments
  const parts: ({ type: 'text'; value: string } | { type: 'link'; value: string })[] = []
  let lastIndex = 0

  for (const link of links) {
    const linkStart = content.indexOf(link.url, lastIndex)
    if (linkStart > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, linkStart) })
    }
    parts.push({ type: 'link', value: link.url })
    lastIndex = linkStart + link.url.length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>
        }

        const isImage = IMAGE_EXTENSIONS.some((ext) => part.value.toLowerCase().endsWith(ext))

        if (isImage) {
          return (
            <span key={i} className="block mt-1.5">
              <a
                href={part.value}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline underline-offset-2 break-all ${isOwn ? 'text-emerald-100 hover:text-white' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300'}`}
              >
                {part.value}
              </a>
              <img
                src={part.value}
                alt="Preview"
                className="mt-1.5 max-h-[250px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </span>
          )
        }

        return (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 break-all ${isOwn ? 'text-emerald-100 hover:text-white' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300'}`}
          >
            {part.value}
          </a>
        )
      })}
    </>
  )
}

// ---- Current user helpers ----
function getCurrentUserRealId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const saved = localStorage.getItem('lanchat-user')
    if (saved) {
      const { userId } = JSON.parse(saved)
      return userId || ''
    }
  } catch {
    // ignore
  }
  return ''
}

interface ChatMessageProps {
  message: ChatMessageType
  isOwn: boolean
  showSender: boolean
  isGrouped?: boolean
  isLastInGroup?: boolean
  roomMembersCount?: number
  onEdit?: (message: ChatMessageType) => void
  onDelete?: (message: ChatMessageType) => void
  onReply?: (message: ChatMessageType) => void
  onPin?: (message: ChatMessageType) => void
  onBookmark?: (message: ChatMessageType) => void
  onForward?: (message: ChatMessageType) => void
  onImageClick?: (url: string) => void
  onOpenPrivateChat?: (userId: string) => void
}

// Deterministic sender accent color for left border (based on username hash)
function getSenderAccentColor(name: string): string {
  const accents = [
    'oklch(0.7 0.15 160 / 50%)',   // emerald
    'oklch(0.75 0.15 80 / 50%)',    // amber
    'oklch(0.65 0.2 25 / 45%)',     // rose
    'oklch(0.65 0.15 300 / 45%)',   // violet
    'oklch(0.7 0.12 195 / 45%)',    // cyan
    'oklch(0.75 0.14 55 / 45%)',    // orange
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return accents[Math.abs(hash) % accents.length]
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  // Within the last 5 minutes -> "just now"
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 5 * 60 * 1000 && diffMs >= 0) {
    return 'just now'
  }

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const days = Math.floor(diffMs / 86400000)
  if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatExactTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function canEditMessage(message: ChatMessageType): boolean {
  if (message.type === 'system') return false
  if (message.deletedAt) return false
  const currentUserId = getCurrentUserRealId()
  if (!currentUserId || message.sender?.id !== currentUserId) return false
  // 5 minute window
  const fiveMinutes = 5 * 60 * 1000
  const sentTime = new Date(message.timestamp).getTime()
  return Date.now() - sentTime < fiveMinutes
}

function canDeleteMessage(message: ChatMessageType): boolean {
  if (message.type === 'system') return false
  if (message.deletedAt) return false
  const currentUserId = getCurrentUserRealId()
  if (!currentUserId || message.sender?.id !== currentUserId) return false
  return true
}

// ---- Reaction Pill Component ----
function ReactionPill({
  reaction,
  onToggle,
}: {
  reaction: MessageReactionInfo
  onToggle: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all duration-200 hover:scale-110 active:scale-95 ${
        reaction.reacted
          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300/60 dark:ring-emerald-700/50 shadow-sm'
          : 'bg-muted/50 dark:bg-muted/30 text-muted-foreground hover:bg-muted dark:bg-muted/40 border border-border/30'
      }`}
    >
      <span className="text-sm leading-none">{reaction.emoji}</span>
      <span className="text-[11px] font-medium leading-none">{reaction.count}</span>
    </button>
  )
}

// ---- Read Receipt Component ----
function ReadReceipt({ message, isOwn }: { message: ChatMessageType; isOwn: boolean }) {
  if (!isOwn) return null

  const readBy = message.readBy || []
  const totalReaders = readBy.length

  if (totalReaders === 0) {
    return (
      <Check className="h-3 w-3 ml-0.5 text-emerald-500 align-text-bottom" />
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCheck className="h-3 w-3 ml-0.5 text-emerald-400 align-text-bottom" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Read by {totalReaders} {totalReaders === 1 ? 'person' : 'people'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---- Reply Quote Component ----
function ReplyQuote({ message }: { message: ChatMessageType }) {
  if (!message.replyTo) return null
  const replySender = message.replyTo.sender
  const replyName = replySender?.displayName || replySender?.username || 'Unknown'

  return (
    <div className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 ${
      message.deletedAt
        ? 'border-gray-400 dark:border-gray-500'
        : 'bg-black/5 dark:bg-white/10 border-emerald-400 dark:border-emerald-500'
    }`}>
      <p className={`text-[10px] font-semibold ${
        message.deletedAt ? 'text-muted-foreground/60' : 'text-emerald-600 dark:text-emerald-400'
      }`}>
        {replyName}
      </p>
      <p className={`text-[11px] truncate ${
        message.deletedAt ? 'text-muted-foreground/50 italic' : 'text-muted-foreground/80'
      }`}>
        {message.replyTo.deletedAt ? 'This message was deleted' : message.replyTo.content}
      </p>
    </div>
  )
}

// ---- Main ChatMessage Component ----
export function ChatMessage({ message, isOwn, showSender, isGrouped, isLastInGroup, roomMembersCount, onEdit, onDelete, onReply, onPin, onBookmark, onForward, onImageClick, onOpenPrivateChat }: ChatMessageProps) {
  const [hovered, setHovered] = useState(false)
  const [animateReactions, setAnimateReactions] = useState(false)
  const [showReactionBar, setShowReactionBar] = useState(false)
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactionBarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)
  const updateMessageReactions = useChatStore((s) => s.updateMessageReactions)
  const bookmarkedMessageIds = useChatStore((s) => s.bookmarkedMessageIds)

  // Derive reactions from store (updated via optimistic toggle or SSE events)
  const reactions = message.reactions || []

  const handleReaction = useCallback((emoji: string) => {
    const userId = getCurrentUserRealId()
    if (!userId) return

    // Compute new reactions based on current store state
    const existing = reactions.find((r) => r.emoji === emoji)
    let newReactions: MessageReactionInfo[]
    if (existing) {
      if (existing.reacted) {
        // Remove
        newReactions = reactions
          .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r)
          .filter((r) => r.count > 0)
      } else {
        // Add to existing
        newReactions = reactions.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
        )
      }
    } else {
      // New reaction
      newReactions = [...reactions, { emoji, count: 1, reacted: true }]
    }

    // Optimistically update store
    updateMessageReactions(message.roomId, message.id, newReactions)

    // Trigger animation
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current)
    setAnimateReactions(true)
    animTimeoutRef.current = setTimeout(() => setAnimateReactions(false), 300)
    const action = existing?.reacted ? 'remove' : 'add'
    fetch('/api/chat/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        messageId: message.id,
        userId,
        emoji,
      }),
    }).catch(console.error)
  }, [message.id, message.roomId, reactions, updateMessageReactions])

  const handleCopy = useCallback(() => {
    if (message.deletedAt) return
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      toast.success('Message copied', {
        description: 'Copied to clipboard',
        duration: 1500,
      })
      setTimeout(() => setCopied(false), 1500)
    })
  }, [message.content, message.deletedAt])

  const handleDoubleClick = useCallback(() => {
    if (canEditMessage(message) && onEdit) {
      onEdit(message)
    }
  }, [message, onEdit])

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (reactionBarTimeoutRef.current) clearTimeout(reactionBarTimeoutRef.current)
    setShowReactionBar(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    reactionBarTimeoutRef.current = setTimeout(() => {
      setShowReactionBar(false)
    }, 300)
  }, [])

  // Deleted message
  if (message.deletedAt || (message.type === 'system' && message.content === 'This message was deleted')) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-muted/40 dark:bg-muted/30 text-muted-foreground/70 text-xs px-4 py-1.5 rounded-full border border-border/30 dark:border-border/20 animate-fade-in">
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3 text-muted-foreground/50" />
            <span className="line-through decoration-muted-foreground/40">Message deleted</span>
          </span>
        </div>
      </div>
    )
  }

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-muted/40 dark:bg-muted/30 text-muted-foreground/70 text-xs px-4 py-1.5 rounded-full border border-border/30 dark:border-border/20">
          {message.content}
        </div>
      </div>
    )
  }

  const senderName = message.sender?.displayName || message.sender?.username || ''
  const avatarColor = getAvatarColor(senderName)
  const editable = canEditMessage(message)
  const deletable = canDeleteMessage(message)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-message-id={message.id}
          className={`flex gap-2.5 px-4 group ${isOwn ? 'flex-row-reverse' : ''} ${isGrouped ? 'py-0.5' : 'pt-2.5 pb-1.5'} hover:scale-[1.01] transition-transform duration-150`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
        >
          {/* Avatar */}
          {!isOwn && !isGrouped && showSender && message.sender ? (
            <UserProfilePopover
              user={message.sender}
              onSendMessage={onOpenPrivateChat}
            >
              <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5 ring-2 ring-background shadow-sm hover:ring-emerald-400/50 transition-all duration-200 cursor-pointer">
                <AvatarFallback className={`text-xs font-semibold ${avatarColor}`}>
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
            </UserProfilePopover>
          ) : !isOwn && isGrouped ? (
            <div className="w-8 flex-shrink-0 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(/\s/g, '')}
              </span>
            </div>
          ) : !isOwn ? (
            <div className="w-8 flex-shrink-0" />
          ) : null}

          {/* Message content */}
          <div className={`max-w-[75%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
            {/* Sender name */}
            {showSender && !isOwn && !isGrouped && message.sender && (
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <UserProfilePopover
                  user={message.sender}
                  onSendMessage={onOpenPrivateChat}
                >
                  <span className="text-[13px] font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-150">
                    {senderName}
                  </span>
                </UserProfilePopover>
                {message.sender.customStatus && (
                  <span className="text-xs" title={message.sender.customStatus}>
                    {message.sender.customStatus.split(/\s/)[0]}
                  </span>
                )}
                <span className={`h-2 w-2 rounded-full ring-2 ring-background ${getStatusColor(message.sender.status)}`} />
              </div>
            )}

            {/* Bubble */}
            <div
              className={`relative px-3.5 py-2 text-sm break-words whitespace-pre-wrap leading-relaxed transition-all duration-200 ${
                isOwn
                  ? 'own-bubble-hover-overlay bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600 text-white rounded-2xl rounded-br-lg shadow-md shadow-emerald-500/15 dark:shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20 dark:hover:shadow-emerald-500/15'
                  : 'other-bubble-accent bg-muted/80 dark:bg-muted/50 text-foreground rounded-2xl rounded-bl-lg shadow-sm shadow-black/[0.03] dark:shadow-black/20 hover:shadow-md hover:shadow-black/[0.06] dark:hover:shadow-black/30 border border-border/30 dark:border-border/20'
              }`}
              style={!isOwn && senderName ? { '--sender-accent': getSenderAccentColor(senderName) } as CSSProperties : undefined}
            >
              {/* Reply quote */}
              <div className="reply-preview-transition">
                <ReplyQuote message={message} />
              </div>

              {/* File preview (images shown above text) */}
              {message.fileUrl && (
                <div className="mb-1.5">
                  <FilePreview
                    fileUrl={message.fileUrl}
                    fileName={message.fileName}
                    fileType={message.fileType}
                    onImageClick={onImageClick}
                    isOwn={isOwn}
                  />
                </div>
              )}

              {/* Message content */}
              <RenderMessageContent content={message.content} isOwn={isOwn} />
              {/* Timestamp tooltip */}
              <span
                className={`absolute bottom-1 ${isOwn ? 'left-2' : 'right-2'} text-[9px] opacity-0 group-hover:opacity-100 transition-opacity ${
                  isOwn ? 'text-emerald-200' : 'text-muted-foreground'
                }`}
                title={formatExactTime(message.timestamp)}
              >
                {formatTime(message.timestamp)}
              </span>
            </div>

            {/* Edited indicator with pencil icon */}
            {message.editedAt && !message.deletedAt && (
              <span className={`text-[10px] text-muted-foreground/50 mt-0.5 px-1 inline-flex items-center gap-0.5 ${isOwn ? 'text-right' : ''}`}>
                <PencilLine className="h-2.5 w-2.5" />
                <span>edited</span>
              </span>
            )}

            {/* Reactions display */}
            {reactions.length > 0 && (
              <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isOwn ? 'justify-end' : ''}`}>
                {reactions.map((r) => (
                  <div
                    key={r.emoji}
                    className={`transition-transform duration-200 ${animateReactions ? 'scale-105' : 'scale-100'}`}
                  >
                    <ReactionPill
                      reaction={r}
                      onToggle={() => handleReaction(r.emoji)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Primary action bar: reaction bar + reply + more menu */}
            <div
              className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? 'justify-end' : ''} transition-all duration-200 ${
                hovered || showReactionBar ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{ transitionProperty: 'opacity, transform' }}
            >
              {/* Quick reaction bar with glass-morphism */}
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background/60 dark:bg-card/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm">
                {QUICK_REACTIONS.map(({ emoji, label }) => {
                  const existingReaction = reactions.find((r) => r.emoji === emoji)
                  return (
                    <TooltipProvider key={emoji} delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReaction(emoji)
                            }}
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-sm transition-all duration-200 hover:scale-125 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:scale-90 ${
                              existingReaction?.reacted
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-300/60 dark:ring-emerald-700/50 shadow-emerald-500/10'
                                : 'hover:shadow-md'
                            }`}
                          >
                            {emoji}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })}
              </div>

              {/* Divider */}
              <div className="w-px h-4 bg-border/40 mx-0.5" />

              {/* Reply button - always visible in hover */}
              {onReply && (
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReply(message)
                        }}
                        className="h-7 w-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:scale-90 shadow-sm bg-background/80 dark:bg-muted/40 backdrop-blur-sm border border-white/20 dark:border-white/10"
                      >
                        <Reply className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Reply</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* More dropdown for secondary actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 w-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-muted dark:hover:bg-muted/60 active:scale-90 shadow-sm bg-background/80 dark:bg-muted/40 backdrop-blur-sm border border-white/20 dark:border-white/10"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align={isOwn ? 'end' : 'start'} className="w-44">
                  {/* Copy text */}
                  <DropdownMenuItem onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 mr-2 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copied ? 'Copied!' : 'Copy text'}
                  </DropdownMenuItem>

                  {/* Forward */}
                  {onForward && (
                    <DropdownMenuItem onClick={() => onForward(message)}>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Forward
                    </DropdownMenuItem>
                  )}

                  {/* Pin */}
                  {onPin && (
                    <DropdownMenuItem onClick={() => onPin(message)}>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin message
                    </DropdownMenuItem>
                  )}

                  {/* Bookmark */}
                  {onBookmark && !message.deletedAt && (
                    <DropdownMenuItem onClick={() => onBookmark(message)}>
                      {bookmarkedMessageIds.has(message.id) ? (
                        <BookmarkCheck className="h-4 w-4 mr-2 text-amber-500" />
                      ) : (
                        <Bookmark className="h-4 w-4 mr-2" />
                      )}
                      {bookmarkedMessageIds.has(message.id) ? 'Remove bookmark' : 'Bookmark'}
                    </DropdownMenuItem>
                  )}

                  {/* Edit & Delete */}
                  {(editable || deletable) && <DropdownMenuSeparator />}
                  {editable && onEdit && (
                    <DropdownMenuItem
                      onClick={() => onEdit(message)}
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit message
                    </DropdownMenuItem>
                  )}
                  {deletable && onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(message)}
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete message
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Timestamp below (when not hovered) */}
            {isLastInGroup && !hovered && (
              <span className={`text-[10px] text-muted-foreground/70 mt-1 px-1 ${isOwn ? 'text-right' : ''}`} title={formatExactTime(message.timestamp)}>
                {formatTime(message.timestamp)}
                {message.editedAt && !message.deletedAt && (
                  <span className="ml-1 italic text-muted-foreground/40 inline-flex items-center gap-0.5">
                    <PencilLine className="h-2 w-2.5" />
                    edited
                  </span>
                )}
                <span className="inline-flex ml-0.5">
                  <ReadReceipt message={message} isOwn={isOwn} />
                </span>
              </span>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        {onReply && (
          <ContextMenuItem onClick={() => onReply(message)}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          {copied ? 'Copied!' : 'Copy text'}
        </ContextMenuItem>
        {onForward && (
          <ContextMenuItem onClick={() => onForward(message)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Forward
          </ContextMenuItem>
        )}
        {onBookmark && !message.deletedAt && (
          <ContextMenuItem onClick={() => onBookmark(message)}>
            {bookmarkedMessageIds.has(message.id) ? (
              <BookmarkCheck className="h-4 w-4 mr-2 text-amber-500" />
            ) : (
              <Bookmark className="h-4 w-4 mr-2" />
            )}
            {bookmarkedMessageIds.has(message.id) ? 'Remove bookmark' : 'Bookmark'}
          </ContextMenuItem>
        )}
        {(editable || deletable) && <ContextMenuSeparator />}
        {editable && onEdit && (
          <ContextMenuItem
            onClick={() => onEdit(message)}
            className="text-emerald-600 dark:text-emerald-400"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit message
          </ContextMenuItem>
        )}
        {deletable && onDelete && (
          <ContextMenuItem
            onClick={() => onDelete(message)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
