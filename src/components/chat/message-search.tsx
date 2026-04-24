'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, MessageSquare, Users, Radio, FileSearch } from 'lucide-react'
import { type ChatMessage, type ChatRoom } from '@/lib/chat-store'
import { getInitials, getAvatarColor } from '@/lib/chat-helpers'

export interface SearchResult {
  message: ChatMessage
  room: ChatRoom
}

interface MessageSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: Map<string, ChatMessage[]>
  rooms: ChatRoom[]
  onSelectMessage: (roomId: string, messageId: string) => void
}

function searchMessages(
  query: string,
  allMessages: Map<string, ChatMessage[]>,
  rooms: ChatRoom[]
): SearchResult[] {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  const roomMap = new Map(rooms.map((r) => [r.id, r]))
  const results: SearchResult[] = []

  allMessages.forEach((msgs, roomId) => {
    const room = roomMap.get(roomId)
    if (!room) return

    for (const msg of msgs) {
      if (msg.type === 'system') continue
      if (msg.content.toLowerCase().includes(lowerQuery)) {
        results.push({ message: msg, room })
      }
    }
  })

  // Sort by timestamp (newest first)
  results.sort(
    (a, b) =>
      new Date(b.message.timestamp).getTime() -
      new Date(a.message.timestamp).getTime()
  )

  return results
}

function formatSearchTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)
  if (index === -1) return text

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)

  return (
    <>
      {before}
      <mark className="bg-emerald-200/70 dark:bg-emerald-700/50 text-foreground rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </>
  )
}

function getRoomLabel(type: string) {
  switch (type) {
    case 'broadcast':
      return 'Broadcast'
    case 'group':
      return 'Group'
    default:
      return 'Direct'
  }
}

export function MessageSearch({
  open,
  onOpenChange,
  messages,
  rooms,
  onSelectMessage,
}: MessageSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const prevOpenRef = useRef(false)

  // Focus input and reset query when dialog opens
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Dialog just opened — schedule focus
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    prevOpenRef.current = open
  }, [open])

  // Reset query when dialog opens (handled via onChange in onOpenChange wrapper)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        // Reset when closing so it's clean next time
        setQuery('')
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const results = useMemo(
    () => searchMessages(query, messages, rooms),
    [query, messages, rooms]
  )

  const handleSelect = useCallback(
    (roomId: string, messageId: string) => {
      onSelectMessage(roomId, messageId)
      onOpenChange(false)
    },
    [onSelectMessage, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden border-border/50 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Messages</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages across all conversations..."
              className="pl-10 pr-4 h-11 rounded-xl border-border/40 bg-muted/20 focus-visible:bg-background focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 text-sm transition-all"
            />
          </div>
        </div>

        {/* Results */}
        <div className="border-t border-border/40">
          {query.trim() && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 dark:from-muted/30 dark:to-muted/10 flex items-center justify-center mb-3">
                <FileSearch className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/70 mb-1.5">
                No results found
              </p>
              <p className="text-xs text-muted-foreground/50 text-center max-w-xs">
                Try a different search term or check your spelling
              </p>
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="max-h-96">
              <div className="divide-y divide-border/30">
                {results.map((result) => {
                  const { message, room } = result
                  const senderName =
                    message.sender?.displayName ||
                    message.sender?.username ||
                    'Unknown'

                  return (
                    <button
                      key={message.id}
                      onClick={() => handleSelect(room.id, message.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-all duration-150 text-left hover:shadow-sm"
                    >
                      {/* Room icon */}
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-lg bg-muted/40 dark:bg-muted/30 flex items-center justify-center ring-1 ring-border/20">
                          {getRoomIcon(room.type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {room.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 h-3.5 font-medium bg-muted/60 text-muted-foreground"
                          >
                            {getRoomLabel(room.type)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">
                            {formatSearchTime(message.timestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-1">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback
                              className={`text-[8px] ${getAvatarColor(senderName)}`}
                            >
                              {getInitials(senderName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground font-medium truncate">
                            {senderName}
                          </span>
                        </div>

                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                          {highlightMatch(
                            truncate(message.content, 120),
                            query
                          )}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          ) : query.trim() ? null : (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-3">
                <Search className="h-5 w-5 text-emerald-500/50" />
              </div>
              <p className="text-xs text-muted-foreground/50 text-center">
                Type to search across all your conversations
              </p>
            </div>
          )}
        </div>

        {/* Footer with result count */}
        {query.trim() && results.length > 0 && (
          <div className="border-t border-border/30 px-4 py-2 bg-muted/20">
            <p className="text-[11px] text-muted-foreground text-center">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
