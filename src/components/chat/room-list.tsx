'use client'

import { useState, useEffect, useMemo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  MessageSquare,
  Users,
  Radio,
  Plus,
  Search,
  Moon,
  Sun,
  Circle,
  LogOut,
  Settings,
  ChevronLeft,
  Menu,
  UserPlus,
  X,
  Wifi,
  RefreshCw,
  Globe,
  Loader2,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { type ChatRoom, type ChatUser } from '@/lib/chat-store'
import { useChatStore } from '@/lib/chat-store'
import { getInitials, getAvatarColor, getStatusColor, formatLastSeen } from '@/lib/chat-helpers'
import { NewGroupDialog } from './new-group-dialog'
import { CustomStatusPicker } from './custom-status-picker'
import { type LANUser } from '@/hooks/use-lan-users'

interface RoomListProps {
  currentUser: ChatUser | null
  rooms: ChatRoom[]
  users: Map<string, ChatUser>
  activeRoom: string | null
  isConnected: boolean
  onSelectRoom: (roomId: string) => void
  onCreateGroup: (name: string, memberIds: string[]) => void
  onUpdateStatus: (status: string) => void
  onLogout: () => void
  onSelectUser?: (userId: string) => void
  onShowOnlineUsers?: () => void
  onOpenSettings?: () => void
  onSetCustomStatus?: (status: string) => void
  onClearCustomStatus?: () => void
  lanUsers?: LANUser[]
  isBridgeRunning?: boolean
  isLANLoading?: boolean
  onRefreshLAN?: () => void
  onLANUserClick?: (user: LANUser) => void
}

function getRoomIcon(type: string, name: string) {
  if (name?.startsWith('LAN: ')) return <Wifi className="h-4 w-4 text-indigo-500" />
  switch (type) {
    case 'broadcast': return <Radio className="h-4 w-4 text-amber-500" />
    case 'group': return <Users className="h-4 w-4 text-indigo-500" />
    default: return <MessageSquare className="h-4 w-4 text-violet-500" />
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

function getRoomDisplayName(room: ChatRoom, currentUserId: string | undefined): string {
  if (room.name) return room.name
  if (room.type === 'private' && room.members && room.members.length > 0) {
    const other = room.members.find((m) => m.userId !== currentUserId)
    return other?.user?.displayName || other?.user?.username || 'Unknown'
  }
  if (room.type === 'broadcast') return 'Broadcast'
  if (room.type === 'group') return 'Group Chat'
  return 'Untitled'
}

// DM Picker Dialog
function DMPickerDialog({
  users,
  currentUser,
  open,
  onOpenChange,
  onSelectUser,
}: {
  users: Map<string, ChatUser>
  currentUser: ChatUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectUser: (userId: string) => void
}) {
  const [search, setSearch] = useState('')

  const onlineUsers = useMemo(() => {
    const all = Array.from(users.values()).filter(
      (u) => u.id !== currentUser?.id && u.status !== 'offline'
    )
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(
      (u) => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
    )
  }, [users, currentUser?.id, search])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-indigo-500" />
            Start a Conversation
          </DialogTitle>
          <DialogDescription>
            Choose an online user to start messaging
          </DialogDescription>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>
        <ScrollArea className="max-h-72 mt-2">
          <div className="space-y-0.5">
            {onlineUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelectUser(user.id)
                  onOpenChange(false)
                  setSearch('')
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/70 transition-all duration-150 text-left animate-fade-in"
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`text-xs font-medium ${getAvatarColor(user.displayName || user.username)}`}>
                      {getInitials(user.displayName || user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(user.status)} ${user.status === 'online' ? 'animate-pulse-glow' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.displayName || user.username}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">{user.status}</p>
                </div>
              </button>
            ))}
            {onlineUsers.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No online users found
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export function RoomList({
  currentUser,
  rooms,
  users,
  activeRoom,
  isConnected,
  onSelectRoom,
  onCreateGroup,
  onUpdateStatus,
  onLogout,
  onSelectUser,
  onShowOnlineUsers,
  onOpenSettings,
  onSetCustomStatus,
  onClearCustomStatus,
  lanUsers = [],
  isBridgeRunning = false,
  isLANLoading = false,
  onRefreshLAN,
  onLANUserClick,
}: RoomListProps) {
  const [search, setSearch] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showDMPicker, setShowDMPicker] = useState(false)
  const { theme, setTheme } = useTheme()
  const unreadCounts = useChatStore((s) => s.unreadCounts)
  const [prevRoomIds, setPrevRoomIds] = useState<Set<string>>(new Set())

  const onlineCount = useMemo(
    () => Array.from(users.values()).filter((u) => u.status !== 'offline').length,
    [users]
  )

  const filteredRooms = useMemo(() => {
    if (!search) return rooms
    const q = search.toLowerCase()
    return rooms.filter((r) => {
      const name = getRoomDisplayName(r, currentUser?.id).toLowerCase()
      return name.includes(q)
    })
  }, [rooms, search, currentUser?.id])

  const broadcasts = filteredRooms.filter((r) => r.type === 'broadcast')
  const groups = filteredRooms.filter((r) => r.type === 'group')
  const privates = filteredRooms
    .filter((r) => r.type === 'private')
    .sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0
      const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0
      return bTime - aTime
    })

  const userList = useMemo(() => Array.from(users.values()), [users])

  // Detect new rooms for animation
  const currentRoomIds = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms])

  const newRoomIds = useMemo(() => {
    const newIds = new Set<string>()
    currentRoomIds.forEach((id) => {
      if (!prevRoomIds.has(id)) newIds.add(id)
    })
    return newIds
  }, [currentRoomIds, prevRoomIds])

  useEffect(() => {
    const timer = setTimeout(() => setPrevRoomIds(currentRoomIds), 0)
    return () => clearTimeout(timer)
  }, [currentRoomIds])

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden flex flex-col h-full bg-background w-full">
        <div className="pt-4 pb-2 px-4 bg-background z-10 sticky top-0 border-b border-border/20 backdrop-blur-md bg-background/80">
          <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
          <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground">
            <span>{onlineCount} online</span>
            <span className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-indigo-500 animate-pulse' : 'bg-red-500'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 pb-24 scroll-smooth">
          {/* DM Quick Start */}
          <div className="mb-2 mt-2">
            <button
              onClick={() => setShowDMPicker(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all duration-200 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group border border-transparent"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center flex-shrink-0">
                <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">New Conversation</p>
                <p className="text-[11px] text-muted-foreground/70 truncate">Start a direct message</p>
              </div>
            </button>
          </div>

          <LANUserSection lanUsers={lanUsers} isBridgeRunning={isBridgeRunning} isLANLoading={isLANLoading} onRefresh={onRefreshLAN} onUserClick={onLANUserClick} />
          {broadcasts.length > 0 && <RoomGroup label="Broadcast" rooms={broadcasts} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />}
          {groups.length > 0 && <RoomGroup label="Groups" rooms={groups} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />}
          <RoomGroup label="Direct Messages" rooms={privates} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
        </ScrollArea>
      </div>
      <div className="hidden md:flex flex-col w-[320px] lg:w-[360px] border-r border-border/30 bg-background h-full shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] relative z-10">
        {/* User Profile */}
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Avatar className="h-10 w-10 ring-2 ring-indigo-500/20">
                <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 dark:from-indigo-900/60 dark:to-violet-900/60 dark:text-indigo-300">
                  {currentUser ? getInitials(currentUser.displayName || currentUser.username) : '?'}
                </AvatarFallback>
              </Avatar>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${getStatusColor(currentUser?.status || 'offline')} ${currentUser?.status === 'online' ? 'animate-pulse-glow' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {currentUser?.displayName || currentUser?.username || 'Anonymous'}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-indigo-500' : 'bg-destructive'}`} />
                  {isConnected ? (
                    <span className="text-indigo-600 dark:text-indigo-400 flex-shrink-0">Connected</span>
                  ) : (
                    <span className="text-destructive flex-shrink-0">Disconnected</span>
                  )}
                  {currentUser?.customStatus && (
                    <span className="truncate">· {currentUser.customStatus}</span>
                  )}
                </p>
              </div>
            <div className="flex items-center gap-0.5">
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CustomStatusPicker
                      currentStatus={currentUser?.customStatus}
                      onSetStatus={onSetCustomStatus || (() => {})}
                      onClearStatus={onClearCustomStatus || (() => {})}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-muted/80"
                        >
                          <span className="text-sm">{currentUser?.customStatus ? currentUser.customStatus.split(/\s/)[0] : '😀'}</span>
                        </Button>
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">Set custom status</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-muted/80"
                      onClick={onShowOnlineUsers}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">Online Users</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {onOpenSettings && (
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-muted/80"
                        onClick={onOpenSettings}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">Settings</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-muted/80"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status Selector */}
        <div className="px-3 py-2 border-b border-border/50 flex gap-1">
          {(['online', 'away', 'busy'] as const).map((status) => (
            <Button
              key={status}
              variant={currentUser?.status === status ? 'default' : 'outline'}
              size="sm"
              className={`flex-1 text-[10px] h-6 px-2 capitalize rounded-lg transition-all duration-200 ${
                currentUser?.status === status
                  ? status === 'online'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20'
                    : status === 'away'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20'
                  : 'hover:bg-muted/80'
              }`}
              onClick={() => onUpdateStatus(status)}
            >
              <Circle className={`h-2 w-2 mr-1 fill-current ${getStatusColor(status)}`} />
              {status}
            </Button>
          ))}
        </div>

        {/* Search with backdrop blur */}
        <div className="px-3 py-2 search-blur-area">
          <div className="relative search-animated-underline">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs rounded-lg border-border/50 bg-muted/30 focus-visible:bg-background focus-visible:border-indigo-500/40 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground/60" />
              </button>
            )}
          </div>
        </div>

        {/* Room List */}
        <ScrollArea className="flex-1 px-2">
          {/* DM Quick Start */}
          <div className="mb-2">
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowDMPicker(true)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl mb-0.5 transition-all duration-200 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:scale-[1.01] active:scale-[0.99] group border border-transparent hover:border-indigo-200/60 dark:hover:border-indigo-800/40 animate-subtle-pulse"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center flex-shrink-0 group-hover:shadow-sm group-hover:shadow-indigo-500/10 transition-all">
                      <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                        New Conversation
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 truncate">
                        Start a direct message
                      </p>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">N</kbd>
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* LAN Network Section */}
          <LANUserSection
            lanUsers={lanUsers}
            isBridgeRunning={isBridgeRunning}
            isLANLoading={isLANLoading}
            onRefresh={onRefreshLAN}
            onUserClick={onLANUserClick}
          />

          {broadcasts.length > 0 && (
            <RoomGroup label="Broadcast" rooms={broadcasts} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
          )}
          {groups.length > 0 && (
            <RoomGroup label="Groups" rooms={groups} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
          )}
          <RoomGroup label="Direct Messages" rooms={privates} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
        </ScrollArea>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs rounded-lg border-dashed border-border/80 hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            onClick={() => setShowNewGroup(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Group
          </Button>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              {onlineCount} user{onlineCount !== 1 ? 's' : ''} online
            </span>
          </p>
        </div>
      </div>

      {/* Mobile Header */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/40 px-6 py-2 flex items-center justify-between shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] pb-safe rounded-t-3xl">
        <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl flex flex-col gap-1 items-center justify-center text-indigo-500 bg-indigo-500/10">
          <MessageSquare className="h-6 w-6" />
          <span className="text-[10px] font-semibold">Chats</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl flex flex-col gap-1 items-center justify-center text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/5">
          <Users className="h-6 w-6" />
          <span className="text-[10px] font-medium">Users</span>
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-14 w-14 rounded-2xl flex flex-col gap-1 items-center justify-center text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/5">
              <Menu className="h-6 w-6" />
              <span className="text-[10px] font-medium">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0">
            <div className="flex flex-col h-full bg-background/95 backdrop-blur-xl rounded-t-3xl">
              <SheetHeader className="p-3 border-b">
                <SheetTitle className="text-left flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                        {currentUser ? getInitials(currentUser.displayName || currentUser.username) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(currentUser?.status || 'offline')} ${currentUser?.status === 'online' ? 'animate-pulse-glow' : ''}`} />
                  </div>
                  <span className="text-sm font-semibold">{currentUser?.displayName || currentUser?.username}</span>
                </SheetTitle>
              </SheetHeader>

              <div className="px-3 py-2 border-b flex gap-1">
                {(['online', 'away', 'busy'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={currentUser?.status === status ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-[10px] h-6 px-1 capitalize transition-all duration-150"
                    onClick={() => { onUpdateStatus(status) }}
                  >
                    <Circle className={`h-2 w-2 mr-0.5 fill-current ${getStatusColor(status)}`} />
                    {status}
                  </Button>
                ))}
              </div>

              <div className="px-3 py-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 px-2">
                {/* DM Quick Start */}
                <button
                  onClick={() => setShowDMPicker(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-2 transition-all duration-150 text-left hover:bg-muted/60 group"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                    <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">New Conversation</p>
                    <p className="text-[11px] text-muted-foreground truncate">Start a direct message</p>
                  </div>
                </button>

                {/* LAN Network Section (Mobile) */}
                <LANUserSection
                  lanUsers={lanUsers}
                  isBridgeRunning={isBridgeRunning}
                  isLANLoading={isLANLoading}
                  onRefresh={onRefreshLAN}
                  onUserClick={onLANUserClick}
                />

                {broadcasts.length > 0 && (
                  <RoomGroup label="Broadcast" rooms={broadcasts} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
                )}
                {groups.length > 0 && (
                  <RoomGroup label="Groups" rooms={groups} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
                )}
                <RoomGroup label="Direct Messages" rooms={privates} activeRoom={activeRoom} onSelect={onSelectRoom} currentUser={currentUser} newRoomIds={newRoomIds} unreadCounts={unreadCounts} />
              </ScrollArea>

              <div className="p-3 border-t space-y-2">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setShowNewGroup(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Group
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun className="h-3.5 w-3.5 mr-1" /> : <Moon className="h-3.5 w-3.5 mr-1" />}
                    Theme
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs text-destructive hover:text-destructive" onClick={onLogout}>
                    <LogOut className="h-3.5 w-3.5 mr-1" />
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>


      </div>

      <NewGroupDialog
        users={userList}
        onCreate={onCreateGroup}
        open={showNewGroup}
        onOpenChange={setShowNewGroup}
      />

      <DMPickerDialog
        users={users}
        currentUser={currentUser}
        open={showDMPicker}
        onOpenChange={setShowDMPicker}
        onSelectUser={onSelectUser || (() => {})}
      />
    </>
  )
}

function LANUserSection({
  lanUsers,
  isBridgeRunning,
  isLANLoading,
  onRefresh,
  onUserClick,
}: {
  lanUsers: LANUser[]
  isBridgeRunning: boolean
  isLANLoading: boolean
  onRefresh?: () => void
  onUserClick?: (user: LANUser) => void
}) {
  return (
    <div className="mb-3">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        <div className="flex items-center gap-1.5 px-1">
          <Globe className="h-3 w-3 text-indigo-500" />
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            LAN Network
          </p>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
      </div>

      {/* Bridge Status */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1">
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isBridgeRunning ? 'bg-indigo-500 animate-pulse-glow shadow-sm shadow-indigo-500/30' : 'bg-destructive/70'}`} />
        <span className={`text-[10px] font-medium ${isBridgeRunning ? 'text-indigo-600 dark:text-indigo-400' : 'text-destructive/70'}`}>
          {isBridgeRunning ? 'Connected' : 'Not running'}
        </span>
        {lanUsers.length > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-auto bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium">
            {lanUsers.length} user{lanUsers.length !== 1 ? 's' : ''}
          </Badge>
        )}
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onRefresh}
                disabled={isLANLoading}
                className="ml-auto h-5 w-5 rounded-md flex items-center justify-center hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                {isLANLoading ? (
                  <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 text-muted-foreground hover:text-indigo-500 transition-colors" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">Refresh LAN users</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* LAN User List */}
      {lanUsers.length > 0 ? (
        <div className="space-y-0.5">
          {lanUsers.map((user) => {
            const mappedStatus = getLANUserStatus(user.status)
            const isOnline = mappedStatus === 'online'
            return (
              <button
                key={user.id}
                onClick={() => onUserClick?.(user)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-left hover:bg-muted/50 hover:scale-[1.01] active:scale-[0.99] group"
              >
                <div className="relative flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center">
                    <Wifi className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${getStatusColor(mappedStatus)} ${isOnline ? 'animate-pulse-glow' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-0 shrink-0">
                      LAN
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 capitalize truncate">
                    {user.status || 'offline'}
                    {user.ip && <span className="text-muted-foreground/40"> · {user.ip}</span>}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="px-2.5 py-2">
          <p className="text-[11px] text-muted-foreground/40 italic">
            {isBridgeRunning ? 'Scanning for LAN users...' : 'LAN bridge is not active'}
          </p>
        </div>
      )}
    </div>
  )
}

function RoomGroup({
  label,
  rooms,
  activeRoom,
  onSelect,
  currentUser,
  newRoomIds,
  unreadCounts,
}: {
  label: string
  rooms: ChatRoom[]
  activeRoom: string | null
  onSelect: (roomId: string) => void
  currentUser: ChatUser | null
  newRoomIds: Set<string>
  unreadCounts: Map<string, number>
}) {
  return (
    <div className="mb-3">
      <div className="gradient-section-separator" />
      <div className="flex items-center gap-3 px-2 mb-1.5">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-1">
          {label}
        </p>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
      </div>
      {rooms.map((room, index) => {
        const isActive = activeRoom === room.id
        const displayName = getRoomDisplayName(room, currentUser?.id)
        const isNew = newRoomIds.has(room.id)
        const unread = unreadCounts.get(room.id) || 0
        // Get other user status for private rooms
        const otherMember = room.type === 'private' && room.members
          ? room.members.find((m) => m.userId !== currentUser?.id)
          : null
        const otherUserStatus = otherMember?.user?.status || 'offline'
        return (
          <button
            key={room.id}
            onClick={() => onSelect(room.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl mb-0.5 transition-all duration-200 text-left group relative overflow-hidden room-item-hover ${
              isActive
                ? 'bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/20 text-indigo-900 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-200/50 dark:ring-indigo-800/40 active-room-border'
                : 'hover:bg-muted/50 active:scale-[0.99]'
            } ${isNew ? 'animate-fade-in' : ''}`}
            style={{ animationDelay: isNew ? '0ms' : `${index * 40}ms` }}
          >
            {room.type === 'private' && room.members && room.members.length > 0 ? (
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={`text-xs font-medium ${getAvatarColor(displayName)}`}>
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${isActive ? 'border-indigo-100 dark:border-indigo-900/30' : 'border-background'} ${getStatusColor(otherUserStatus)} ${otherUserStatus === 'online' ? 'animate-pulse-glow' : ''}`} />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">
                      {otherUserStatus === 'offline' && otherMember?.user?.lastSeen
                        ? `Last seen ${formatLastSeen(otherMember.user.lastSeen)}`
                        : otherUserStatus.charAt(0).toUpperCase() + otherUserStatus.slice(1)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-indigo-100 dark:bg-indigo-800/40' : 'bg-muted'}`}>
                {getRoomIcon(room.type, room.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium truncate ${isActive ? 'font-semibold' : ''} ${unread > 0 ? 'font-bold' : ''}`}>{displayName}</p>
                {room.lastMessage && (
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 ml-1">
                    {formatLastSeen(room.lastMessage.timestamp)}
                  </span>
                )}
              </div>
              {room.lastMessage && (
                <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                  {room.lastMessage.sender
                    ? `${room.lastMessage.sender.displayName || room.lastMessage.sender.username}: `
                    : ''}
                  {room.lastMessage.content}
                </p>
              )}
            </div>
            {/* Unread Badge */}
            {unread > 0 && (
              <span className="flex items-center justify-center flex-shrink-0">
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-indigo-500/30 animate-fade-in animate-breathe-dot">
                  {unread <= 9 ? unread : '9+'}
                </span>
              </span>
            )}
          </button>
        )
      })}
      {rooms.length === 0 && (
        <p className="text-[11px] text-muted-foreground/50 text-center py-3 italic">No conversations</p>
      )}
    </div>
  )
}
