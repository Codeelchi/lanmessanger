'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Copy, Check } from 'lucide-react'
import { getInitials, getAvatarColor, getStatusColor, formatLastSeen } from '@/lib/chat-helpers'
import type { ChatUser } from '@/lib/chat-store'
import { toast } from 'sonner'

interface UserProfilePopoverProps {
  user: ChatUser | null
  children: React.ReactNode
  onSendMessage?: (userId: string) => void
  showActions?: boolean
}

export function UserProfilePopover({ user, children, onSendMessage, showActions = true }: UserProfilePopoverProps) {
  const [copied, setCopied] = useState(false)

  if (!user) return <>{children}</>

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(user.username).then(() => {
      setCopied(true)
      toast.success('Username copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error('Failed to copy username')
    })
  }

  const handleSendDM = () => {
    if (onSendMessage) {
      onSendMessage(user.id)
    }
  }

  const statusLabel = user.status === 'online' ? 'Online' : user.status === 'away' ? 'Away' : 'Busy'
  const lastSeenText = user.lastSeen ? formatLastSeen(user.lastSeen) : ''

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 gap-0" side="top" align="start" sideOffset={8}>
        <div className="p-4 pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
              <AvatarFallback
                className={`${getAvatarColor(user.id)} text-white font-semibold text-sm`}
              >
                {getInitials(user.displayName || user.username)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate">{user.displayName || user.username}</h4>
              <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`h-2 w-2 rounded-full ${getStatusColor(user.status)} ${user.status === 'online' ? 'animate-status-pulse' : ''}`} />
                <span className="text-[11px] text-muted-foreground">
                  {user.status === 'offline' ? lastSeenText : statusLabel}
                </span>
              </div>
            </div>
          </div>

          {user.customStatus && (
            <div className="mt-3 px-3 py-1.5 rounded-lg bg-muted/50 text-xs text-muted-foreground text-center">
              {user.customStatus}
            </div>
          )}

          {user.statusMessage && !/^\p{Emoji_Presentation}/u.test(user.statusMessage) && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-muted/50 text-xs text-muted-foreground text-center italic">
              {user.statusMessage}
            </div>
          )}
        </div>

        {showActions && (
          <div className="border-t border-border/50 p-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleCopyUsername}
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy ID'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={handleSendDM}
            >
              <MessageSquare className="h-3 w-3" />
              Message
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
