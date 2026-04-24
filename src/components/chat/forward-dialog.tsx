'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Users, MessageSquare, ArrowRightLeft, Radio } from 'lucide-react'
import { type ChatRoom, type ChatMessage } from '@/lib/chat-store'
import { getInitials } from '@/lib/chat-helpers'

interface ForwardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: ChatMessage | null
  rooms: ChatRoom[]
  currentUserId: string
  onForward: (roomId: string, message: ChatMessage) => void
}

function getRoomIcon(type: string) {
  switch (type) {
    case 'broadcast': return <Radio className="h-4 w-4 text-amber-500" />
    case 'group': return <Users className="h-4 w-4 text-emerald-500" />
    default: return <MessageSquare className="h-4 w-4 text-teal-500" />
  }
}

function getRoomDisplayName(room: ChatRoom, currentUserId: string): string {
  if (room.name) return room.name
  if (room.type === 'private' && room.members && room.members.length > 0) {
    const other = room.members.find((m) => m.userId !== currentUserId)
    return other?.user?.displayName || other?.user?.username || 'Unknown'
  }
  if (room.type === 'broadcast') return 'Broadcast'
  if (room.type === 'group') return 'Group Chat'
  return 'Untitled'
}

export function ForwardDialog({
  open,
  onOpenChange,
  message,
  rooms,
  currentUserId,
  onForward,
}: ForwardDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [forwarding, setForwarding] = useState(false)

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms
    const q = search.toLowerCase()
    return rooms.filter((r) => {
      const name = getRoomDisplayName(r, currentUserId).toLowerCase()
      return name.includes(q)
    })
  }, [rooms, search, currentUserId])

  const handleForward = useCallback(() => {
    if (!selectedRoomId || !message) return
    setForwarding(true)
    onForward(selectedRoomId, message)
    // Reset state after a short delay
    setTimeout(() => {
      setForwarding(false)
      setSelectedRoomId(null)
      setSearch('')
      onOpenChange(false)
    }, 200)
  }, [selectedRoomId, message, onForward, onOpenChange])

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setSelectedRoomId(null)
      setSearch('')
      setForwarding(false)
    }
    onOpenChange(isOpen)
  }, [onOpenChange])

  const senderName = message?.sender?.displayName || message?.sender?.username || 'Unknown'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
            Forward Message
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose a room to forward this message to
          </DialogDescription>
        </DialogHeader>

        {/* Original message preview */}
        {message && (
          <div className="mx-6 mb-3 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/40">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">
              Forwarding from {senderName}
            </p>
            <p className="text-xs text-foreground/90 line-clamp-2">
              {message.content || (message.fileUrl ? `📎 ${message.fileName || 'File'}` : 'Empty message')}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs rounded-lg"
            />
          </div>
        </div>

        {/* Room list */}
        <ScrollArea className="max-h-64 px-6">
          <div className="space-y-0.5 pb-2">
            {filteredRooms.map((room) => {
              const isSelected = selectedRoomId === room.id
              const displayName = getRoomDisplayName(room, currentUserId)
              // Exclude the current room (where the message came from)
              const isOriginalRoom = message && room.id === message.roomId

              if (isOriginalRoom) return null

              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(isSelected ? null : room.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-300/60 dark:ring-emerald-700/50'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-emerald-100 dark:bg-emerald-800/40' : 'bg-muted'
                  }`}>
                    {getRoomIcon(room.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                      {displayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {room.type === 'private'
                        ? `${room.members?.length || 2} members`
                        : `${room.members?.length || 0} members`}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
            {filteredRooms.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No rooms found
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 pt-3 border-t border-border/50 bg-muted/20 flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs rounded-lg"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
            onClick={handleForward}
            disabled={!selectedRoomId || forwarding}
          >
            {forwarding ? 'Forwarding...' : 'Forward'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
