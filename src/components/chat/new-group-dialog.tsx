'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Users } from 'lucide-react'
import { type ChatUser } from '@/lib/chat-store'

interface NewGroupDialogProps {
  users: ChatUser[]
  onCreate: (name: string, memberIds: string[], description?: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewGroupDialog({ users, onCreate, open, onOpenChange }: NewGroupDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())

  const onlineUsers = users.filter((u) => u.status !== 'offline')

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleCreate = () => {
    if (!groupName.trim() || selectedMembers.size === 0) return
    onCreate(groupName.trim(), Array.from(selectedMembers), groupDescription.trim())
    setGroupName('')
    setGroupDescription('')
    setSelectedMembers(new Set())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Create New Group
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/70">
            Start a group conversation with your team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-xs font-medium">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g., Design Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="rounded-xl h-10 border-border/50 bg-muted/20 focus-visible:bg-background focus-visible:border-emerald-500/40 transition-all text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="group-description" className="text-xs font-medium">Description (optional)</Label>
              <span className="text-[10px] text-muted-foreground/50">{groupDescription.length}/500</span>
            </div>
            <Input
              id="group-description"
              placeholder="What is this group about?"
              value={groupDescription}
              onChange={(e) => {
                if (e.target.value.length <= 500) setGroupDescription(e.target.value)
              }}
              className="rounded-xl h-10 border-border/50 bg-muted/20 focus-visible:bg-background focus-visible:border-emerald-500/40 transition-all text-sm"
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Select Members <span className="text-emerald-600 dark:text-emerald-400">({selectedMembers.size} selected)</span>
            </Label>
            <ScrollArea className="h-48 rounded-xl border border-border/40 bg-muted/10 p-2">
              <div className="space-y-1">
                {onlineUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-2">
                      <Users className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs text-muted-foreground/60">No online users</p>
                  </div>
                ) : (
                  onlineUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleMember(user.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-all duration-150 text-left"
                    >
                      <div
                        className={`h-4.5 w-4.5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                          selectedMembers.has(user.id)
                            ? 'bg-emerald-600 border-emerald-600 scale-110'
                            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
                        }`}
                      >
                        {selectedMembers.has(user.id) && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium flex-1 truncate">
                        {user.displayName || user.username}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-medium capitalize">
                        {user.status}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedMembers.size === 0}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:shadow-none"
          >
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
