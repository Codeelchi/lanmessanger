'use client'

import { useMemo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Search, Globe, Wifi } from 'lucide-react'
import { useState } from 'react'
import { type ChatUser } from '@/lib/chat-store'
import { getInitials, getAvatarColor, getStatusColor, formatLastSeen } from '@/lib/chat-helpers'
import { type LANUser } from '@/hooks/use-lan-users'

interface OnlineUsersPanelProps {
  users: Map<string, ChatUser>
  currentUser: ChatUser | null
  onSelectUser: (userId: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  lanUsers?: LANUser[]
  isBridgeRunning?: boolean
  onLANUserClick?: (user: LANUser) => void
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'online': return { label: 'Online', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' }
    case 'away': return { label: 'Away', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' }
    case 'busy': return { label: 'Busy', className: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' }
    default: return { label: 'Offline', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400' }
  }
}

/** Map LAN Messenger status to web chat status */
function getLANUserStatus(lanStatus: string): string {
  switch (lanStatus?.toLowerCase()) {
    case 'chat': return 'online'
    case 'busy': return 'busy'
    case 'away': return 'away'
    case 'gone': return 'offline'
    default: return 'offline'
  }
}

function UserItem({
  user,
  isCurrentUser,
  onSelect,
}: {
  user: ChatUser
  isCurrentUser: boolean
  onSelect: (userId: string) => void
}) {
  const badge = getStatusBadge(user.status)
  const isOnline = user.status === 'online'

  return (
    <button
      onClick={() => !isCurrentUser && onSelect(user.id)}
      disabled={isCurrentUser}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left animate-fade-in ${
        isCurrentUser
          ? 'opacity-60 cursor-default'
          : 'hover:bg-muted/60 hover:scale-[1.01] active:scale-[0.99] cursor-pointer hover:shadow-sm'
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-9 w-9 ring-1 ring-border/30">
          <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(user.displayName || user.username)}`}>
            {getInitials(user.displayName || user.username)}
          </AvatarFallback>
        </Avatar>
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(user.status)} ${isOnline ? 'animate-pulse-glow' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">
            {user.displayName || user.username}
          </p>
          {isCurrentUser && (
            <span className="text-[10px] text-muted-foreground font-normal">(you)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 font-medium ${badge.className}`}>
            {badge.label}
          </Badge>
          {!isOnline && user.lastSeen && (
            <span className="text-[10px] text-muted-foreground">
              {formatLastSeen(user.lastSeen)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function UserListContent({
  users,
  currentUser,
  onSelectUser,
  lanUsers = [],
  isBridgeRunning = false,
  onLANUserClick,
}: {
  users: Map<string, ChatUser>
  currentUser: ChatUser | null
  onSelectUser: (userId: string) => void
  lanUsers?: LANUser[]
  isBridgeRunning?: boolean
  onLANUserClick?: (user: LANUser) => void
}) {
  const [search, setSearch] = useState('')

  const filteredUsers = useMemo(() => {
    const allUsers = Array.from(users.values())
    if (!search.trim()) return allUsers
    const q = search.toLowerCase()
    return allUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
    )
  }, [users, search])

  const groupedUsers = useMemo(() => {
    const online = filteredUsers.filter((u) => u.status === 'online')
    const away = filteredUsers.filter((u) => u.status === 'away')
    const busy = filteredUsers.filter((u) => u.status === 'busy')
    const offline = filteredUsers.filter((u) => u.status === 'offline')
    return { online, away, busy, offline }
  }, [filteredUsers])

  const totalOnline = groupedUsers.online.length + groupedUsers.away.length + groupedUsers.busy.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Online Users</h3>
          <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 font-medium shadow-sm">
            {totalOnline} online
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs rounded-lg border-border/40 bg-muted/20 focus-visible:bg-background focus-visible:border-emerald-500/40 transition-all"
          />
        </div>
      </div>

      {/* User Groups */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          {/* LAN Network Section */}
          {lanUsers.length > 0 && (
            <LANUserGroup
              lanUsers={lanUsers}
              isBridgeRunning={isBridgeRunning}
              onUserClick={onLANUserClick}
            />
          )}

          {groupedUsers.online.length > 0 && (
            <UserGroup
              label="Online"
              count={groupedUsers.online.length}
              color="text-emerald-500"
              users={groupedUsers.online}
              currentUser={currentUser}
              onSelectUser={onSelectUser}
            />
          )}
          {groupedUsers.away.length > 0 && (
            <UserGroup
              label="Away"
              count={groupedUsers.away.length}
              color="text-amber-500"
              users={groupedUsers.away}
              currentUser={currentUser}
              onSelectUser={onSelectUser}
            />
          )}
          {groupedUsers.busy.length > 0 && (
            <UserGroup
              label="Busy"
              count={groupedUsers.busy.length}
              color="text-red-500"
              users={groupedUsers.busy}
              currentUser={currentUser}
              onSelectUser={onSelectUser}
            />
          )}
          {groupedUsers.offline.length > 0 && (
            <UserGroup
              label="Offline"
              count={groupedUsers.offline.length}
              color="text-gray-400"
              users={groupedUsers.offline}
              currentUser={currentUser}
              onSelectUser={onSelectUser}
            />
          )}
          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 dark:from-muted/30 dark:to-muted/10 flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground/60">No users found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function UserGroup({
  label,
  count,
  color,
  users,
  currentUser,
  onSelectUser,
}: {
  label: string
  count: number
  color: string
  users: ChatUser[]
  currentUser: ChatUser | null
  onSelectUser: (userId: string) => void
}) {
  return (
    <div className="mb-3">
      <p className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1.5 ${color}`}>
        {label} ({count})
      </p>
      {users.map((user) => (
        <UserItem
          key={user.id}
          user={user}
          isCurrentUser={currentUser?.id === user.id}
          onSelect={onSelectUser}
        />
      ))}
    </div>
  )
}

function LANUserGroup({
  lanUsers,
  isBridgeRunning,
  onUserClick,
}: {
  lanUsers: LANUser[]
  isBridgeRunning: boolean
  onUserClick?: (user: LANUser) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <Globe className="h-3 w-3 text-emerald-500" />
        <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">
          LAN Network
        </p>
        <span className={`h-1.5 w-1.5 rounded-full ml-1 ${isBridgeRunning ? 'bg-emerald-500' : 'bg-destructive/70'}`} />
        <span className="text-[9px] text-muted-foreground ml-0.5">{lanUsers.length}</span>
      </div>
      {lanUsers.map((user) => {
        const mappedStatus = getLANUserStatus(user.status)
        const isOnline = mappedStatus === 'online'
        const badge = getStatusBadge(mappedStatus)
        return (
          <button
            key={user.id}
            onClick={() => onUserClick?.(user)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left animate-fade-in hover:bg-muted/60 hover:scale-[1.01] active:scale-[0.99] cursor-pointer hover:shadow-sm"
          >
            <div className="relative flex-shrink-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center ring-1 ring-border/30">
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(mappedStatus)} ${isOnline ? 'animate-pulse-glow' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-0 shrink-0">
                  LAN
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 font-medium ${badge.className}`}>
                  {badge.label}
                </Badge>
                {user.ip && (
                  <span className="text-[10px] text-muted-foreground">
                    {user.ip}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function OnlineUsersPanel({
  users,
  currentUser,
  onSelectUser,
  open,
  onOpenChange,
  lanUsers,
  isBridgeRunning,
  onLANUserClick,
}: OnlineUsersPanelProps) {
  const content = (
    <UserListContent
      users={users}
      currentUser={currentUser}
      onSelectUser={onSelectUser}
      lanUsers={lanUsers}
      isBridgeRunning={isBridgeRunning}
      onLANUserClick={onLANUserClick}
    />
  )

  return (
    <>
      {/* Desktop: Slide-in panel */}
      <div
        className={`hidden lg:flex flex-col w-72 border-l border-border/40 bg-gradient-to-b from-muted/30 to-muted/10 dark:from-muted/15 dark:to-muted/5 h-full animate-slide-in-right transition-all duration-200 ${
          open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none absolute right-0'
        }`}
        style={{ display: open ? 'flex' : 'none' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Users</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </div>

      {/* Mobile: Sheet */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Online Users</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    </>
  )
}
