'use client'

import { useState, useCallback, useMemo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus, LogOut, Info, Pencil, Check, X, Bookmark, BookmarkCheck } from 'lucide-react'
import { type ChatRoom, type ChatUser, type ChatMessage } from '@/lib/chat-store'
import { useChatStore } from '@/lib/chat-store'
import { getInitials, getStatusColor } from '@/lib/chat-helpers'

interface UserInfoPanelProps {
  room: ChatRoom | null
  users: Map<string, ChatUser>
  currentUser: ChatUser | null
  messages?: Map<string, ChatMessage[]>
  onAddMember?: () => void
  onLeaveGroup?: () => void
  onOpenPrivateChat?: (userId: string) => void
  onEditRoom?: (roomId: string, updates: { name?: string; description?: string }) => void
}

function getStatusText(status: string): string {
  switch (status) {
    case 'online': return 'Online'
    case 'away': return 'Away'
    case 'busy': return 'Busy'
    default: return 'Offline'
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function UserInfoPanel({
  room,
  users,
  currentUser,
  messages,
  onAddMember,
  onLeaveGroup,
  onOpenPrivateChat,
  onEditRoom,
}: UserInfoPanelProps) {
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const bookmarkedMessageIds = useChatStore((s) => s.bookmarkedMessageIds)

  const isAdmin = room?.members?.some(
    (m) => m.userId === currentUser?.id && m.role === 'admin'
  ) || false

  // Get bookmarked messages for the current room
  const bookmarkedMessages = useMemo(() => {
    if (!room || !messages) return []
    const roomMsgs = messages.get(room.id) || []
    return roomMsgs.filter((msg) => bookmarkedMessageIds.has(msg.id) && msg.type !== 'system' && !msg.deletedAt)
  }, [room, messages, bookmarkedMessageIds])

  const handleStartEditDescription = useCallback(() => {
    if (!room) return
    setDescriptionDraft(room.description || '')
    setEditingDescription(true)
  }, [room])

  const handleSaveDescription = useCallback(() => {
    if (!room || !onEditRoom) return
    onEditRoom(room.id, { description: descriptionDraft })
    setEditingDescription(false)
  }, [room, descriptionDraft, onEditRoom])

  const handleCancelEditDescription = useCallback(() => {
    setEditingDescription(false)
  }, [])

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 dark:from-muted/30 dark:to-muted/10 flex items-center justify-center mb-4">
          <Info className="h-8 w-8 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground/70">Select a conversation to see details</p>
      </div>
    )
  }

  const typeLabel = room.type === 'broadcast' ? 'Broadcast' : room.type === 'group' ? 'Group' : 'Direct'
  const typeColor = room.type === 'broadcast' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    : room.type === 'group' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
    : 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300'

  return (
    <div className="flex flex-col h-full">
      {/* Room Info */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-12 w-12 ring-2 ring-emerald-500/10">
            <AvatarFallback className="text-base font-semibold bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-900/50 dark:to-teal-900/50 dark:text-emerald-300">
              {getInitials(room.name || 'Room')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{room.name || 'Untitled Room'}</h3>
            <Badge variant="secondary" className={`text-[10px] px-2 py-0 mt-1 ${typeColor}`}>
              {typeLabel}
            </Badge>
          </div>
        </div>

        {/* Room Description */}
        {room.type === 'group' && (
          <div className="mt-2">
            {editingDescription ? (
              <div className="space-y-2 animate-fade-in">
                <Textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Add a description..."
                  className="min-h-[60px] text-xs resize-none"
                  maxLength={500}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/50">
                    {descriptionDraft.length}/500
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] rounded-md"
                      onClick={handleCancelEditDescription}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-[10px] rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleSaveDescription}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {room.description ? (
                    <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap">{room.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 italic">No description</p>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={handleStartEditDescription}
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/50 mt-2">
          Created {formatDate(room.createdAt)}
        </p>
      </div>

      {/* Actions */}
      {room.type === 'group' && (
        <div className="p-3 border-b border-border/50 flex gap-2">
          {onAddMember && (
            <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={onAddMember}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Add Member
            </Button>
          )}
          {onLeaveGroup && (
            <Button variant="outline" size="sm" className="flex-1 text-xs h-8 text-destructive hover:text-destructive" onClick={onLeaveGroup}>
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Leave
            </Button>
          )}
        </div>
      )}

      {/* Bookmarks Section */}
      {bookmarkedMessages.length > 0 && (
        <div className="border-b border-border/50">
          <div className="px-4 py-2">
            <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
              <Bookmark className="h-3 w-3 text-amber-500" />
              Bookmarks ({bookmarkedMessages.length})
            </h4>
          </div>
          <ScrollArea className="max-h-48">
            <div className="px-2 pb-2 space-y-1">
              {bookmarkedMessages.map((msg) => (
                <button
                  key={msg.id}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-all duration-200 animate-fade-in"
                  onClick={() => {
                    // Scroll to the bookmarked message
                    const msgEl = document.querySelector(`[data-message-id="${msg.id}"]`)
                    if (msgEl) {
                      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      msgEl.classList.add('ring-2', 'ring-amber-400', 'dark:ring-amber-500')
                      setTimeout(() => {
                        msgEl.classList.remove('ring-2', 'ring-amber-400', 'dark:ring-amber-500')
                      }, 2000)
                    }
                  }}
                >
                  <p className="text-[11px] font-medium text-muted-foreground/70 mb-0.5">
                    {msg.sender?.displayName || msg.sender?.username || 'Unknown'}
                    <span className="ml-1.5 text-muted-foreground/40">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  </p>
                  <p className="text-xs text-foreground/80 truncate">{msg.content}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Members */}
      <div className="flex-1 overflow-hidden">
        <div className="px-4 py-2">
          <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
            Members ({room.members?.length || 0})
          </h4>
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="px-2 pb-4">
            {(room.members || []).map((member) => {
              const user = member.user
              const isCurrentUser = currentUser?.id === user.id
              return (
                <button
                  key={member.userId}
                  onClick={() => onOpenPrivateChat?.(user.id)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 transition-all duration-200 text-left hover:shadow-sm"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8 ring-1 ring-border/30">
                      <AvatarFallback className="text-xs font-medium bg-muted/60">
                        {getInitials(user.displayName || user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(user.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.displayName || user.username}
                      {isCurrentUser && <span className="text-muted-foreground font-normal"> (you)</span>}
                    </p>
                    {user.customStatus ? (
                      <p className="text-[10px] text-muted-foreground truncate">{user.customStatus}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">{getStatusText(user.status)}</p>
                    )}
                  </div>
                  {member.role === 'admin' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Admin
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
