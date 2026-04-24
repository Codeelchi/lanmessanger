'use client'

import { useState, useCallback } from 'react'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Volume2, VolumeX, Bell, Check, User, Palette, Settings, Wallpaper } from 'lucide-react'
import type { ChatUser } from '@/lib/chat-store'

interface UserSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: ChatUser | null
  onUpdateProfile: (userId: string, displayName: string) => void
  onUpdateStatusMessage?: (userId: string, statusMessage: string) => void
}

const AVATAR_COLORS = [
  { name: 'emerald', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { name: 'amber', class: 'bg-amber-500', ring: 'ring-amber-500' },
  { name: 'rose', class: 'bg-rose-500', ring: 'ring-rose-500' },
  { name: 'violet', class: 'bg-violet-500', ring: 'ring-violet-500' },
  { name: 'cyan', class: 'bg-cyan-500', ring: 'ring-cyan-500' },
  { name: 'orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
  { name: 'teal', class: 'bg-teal-500', ring: 'ring-teal-500' },
  { name: 'pink', class: 'bg-pink-500', ring: 'ring-pink-500' },
  { name: 'lime', class: 'bg-lime-500', ring: 'ring-lime-500' },
  { name: 'sky', class: 'bg-sky-500', ring: 'ring-sky-500' },
]

function getSettings(): { sound: boolean; desktopNotifications: boolean } {
  if (typeof window === 'undefined') return { sound: true, desktopNotifications: false }
  try {
    const saved = localStorage.getItem('lanchat-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        sound: parsed.sound !== false,
        desktopNotifications: parsed.desktopNotifications === true,
      }
    }
  } catch {}
  return { sound: true, desktopNotifications: false }
}

function saveSettings(settings: { sound: boolean; desktopNotifications: boolean }) {
  try {
    localStorage.setItem('lanchat-settings', JSON.stringify(settings))
  } catch {}
}

function getAvatarColor(): string {
  if (typeof window === 'undefined') return 'emerald'
  try {
    return localStorage.getItem('lanchat-avatar-color') || 'emerald'
  } catch {
    return 'emerald'
  }
}

function saveAvatarColor(color: string) {
  try {
    localStorage.setItem('lanchat-avatar-color', color)
  } catch {}
}

export type WallpaperOption = 'default' | 'dots' | 'gradient' | 'night' | 'mesh' | 'paper'

function getWallpaper(): WallpaperOption {
  if (typeof window === 'undefined') return 'default'
  try {
    return (localStorage.getItem('lanchat-wallpaper') as WallpaperOption) || 'default'
  } catch {
    return 'default'
  }
}

function saveWallpaper(wallpaper: WallpaperOption) {
  try {
    localStorage.setItem('lanchat-wallpaper', wallpaper)
  } catch {}
}

const WALLPAPER_OPTIONS: { value: WallpaperOption; label: string; previewClass: string }[] = [
  { value: 'default', label: 'Default', previewClass: 'bg-background' },
  { value: 'dots', label: 'Subtle Dots', previewClass: 'chat-wallpaper-dots bg-background' },
  { value: 'gradient', label: 'Soft Gradient', previewClass: 'chat-wallpaper-gradient bg-background' },
  { value: 'mesh', label: 'Dark Mesh', previewClass: 'chat-wallpaper-mesh' },
  { value: 'paper', label: 'Warm Paper', previewClass: 'chat-wallpaper-paper' },
  { value: 'night', label: 'Night Sky', previewClass: 'chat-wallpaper-night bg-background' },
]

// Inner form component - mounts fresh each time dialog opens
function SettingsForm({ currentUser, onSave, onCancel }: {
  currentUser: ChatUser
  onSave: (displayName: string, sound: boolean, desktopNotifications: boolean, selectedColor: string, statusMessage: string, selectedWallpaper: WallpaperOption) => void
  onCancel: () => void
}) {
  const { theme, setTheme } = useTheme()
  const [displayName, setDisplayName] = useState(currentUser.displayName || currentUser.username)
  const [sound, setSound] = useState(() => getSettings().sound)
  const [desktopNotifications, setDesktopNotifications] = useState(() => getSettings().desktopNotifications)
  const [selectedColor, setSelectedColor] = useState(() => getAvatarColor())
  const [statusMessage, setStatusMessage] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return localStorage.getItem('lanchat-status-message') || '' } catch { return '' }
  })
  const [selectedWallpaper, setSelectedWallpaper] = useState<WallpaperOption>(() => getWallpaper())
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    onSave(displayName, sound, desktopNotifications, selectedColor, statusMessage, selectedWallpaper)
    setSaving(false)
  }, [displayName, sound, desktopNotifications, selectedColor, statusMessage, selectedWallpaper, onSave])

  const handleToggleDesktopNotifications = useCallback(async (checked: boolean) => {
    if (checked) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          setDesktopNotifications(true)
          saveSettings({ sound, desktopNotifications: true })
        }
      }
    } else {
      setDesktopNotifications(false)
      saveSettings({ sound, desktopNotifications: false })
    }
  }, [sound])

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const

  return (
    <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
      <DialogHeader className="p-6 pb-4">
        <DialogTitle className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-emerald-500" />
          Settings
        </DialogTitle>
        <DialogDescription>
          Manage your profile and preferences
        </DialogDescription>
      </DialogHeader>

      <div className="px-6 pb-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {/* Profile Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-emerald-500" />
            Profile
          </div>
          <div className="space-y-2 pl-6">
            <div className="space-y-1.5">
              <Label htmlFor="settings-username" className="text-xs text-muted-foreground">Username</Label>
              <Input
                id="settings-username"
                value={currentUser.username}
                disabled
                className="h-9 text-xs bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-displayname" className="text-xs text-muted-foreground">Display Name</Label>
              <Input
                id="settings-displayname"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9 text-xs"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="settings-statusmessage" className="text-xs text-muted-foreground">Status Message</Label>
                <span className={`text-[10px] ${statusMessage.length >= 100 ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                  {statusMessage.length}/100
                </span>
              </div>
              <Input
                id="settings-statusmessage"
                placeholder="What are you up to?"
                value={statusMessage}
                onChange={(e) => {
                  if (e.target.value.length <= 100) {
                    setStatusMessage(e.target.value)
                  }
                }}
                className="h-9 text-xs"
                maxLength={100}
              />
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Appearance Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sun className="h-4 w-4 text-emerald-500" />
            Appearance
          </div>
          <div className="pl-6">
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                    theme === value
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 shadow-sm ring-1 ring-emerald-200/50 dark:ring-emerald-800/50'
                      : 'bg-muted/30 border-border/50 hover:bg-muted/60 hover:border-border'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${theme === value ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                  <span className={`text-[11px] font-medium ${theme === value ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Notifications Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-emerald-500" />
            Notifications
          </div>
          <div className="space-y-3 pl-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {sound ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-xs font-medium">Sound</p>
                  <p className="text-[10px] text-muted-foreground">Play sounds for messages</p>
                </div>
              </div>
              <Switch
                checked={sound}
                onCheckedChange={(checked) => {
                  setSound(checked)
                  saveSettings({ sound: checked, desktopNotifications })
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Desktop Notifications</p>
                  <p className="text-[10px] text-muted-foreground">Get browser notifications</p>
                </div>
              </div>
              <Switch
                checked={desktopNotifications}
                onCheckedChange={handleToggleDesktopNotifications}
              />
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Chat Wallpaper Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wallpaper className="h-4 w-4 text-emerald-500" />
            Chat Background
          </div>
          <div className="pl-6">
            <div className="grid grid-cols-3 gap-3">
              {WALLPAPER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedWallpaper(option.value)}
                  className={`flex flex-col items-center gap-2 px-2 py-2.5 rounded-xl border transition-all duration-200 ${
                    selectedWallpaper === option.value
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 shadow-sm ring-2 ring-emerald-400/40 dark:ring-emerald-600/40'
                      : 'bg-muted/30 border-border/50 hover:bg-muted/60 hover:border-border'
                  }`}
                >
                  <div className={`w-[60px] h-[60px] rounded-lg border border-border/30 ${option.previewClass} overflow-hidden`}>
                    {option.value === 'dots' && (
                      <div className="w-full h-full chat-wallpaper-dots" />
                    )}
                    {option.value === 'mesh' && (
                      <div className="w-full h-full chat-wallpaper-mesh" />
                    )}
                    {option.value === 'gradient' && (
                      <div className="w-full h-full chat-wallpaper-gradient" />
                    )}
                    {option.value === 'night' && (
                      <div className="w-full h-full chat-wallpaper-night" />
                    )}
                    {option.value === 'paper' && (
                      <div className="w-full h-full chat-wallpaper-paper" />
                    )}
                  </div>
                  <span className={`text-[11px] font-medium ${
                    selectedWallpaper === option.value
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-muted-foreground'
                  }`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Avatar Color Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Palette className="h-4 w-4 text-emerald-500" />
            Avatar Color
          </div>
          <div className="pl-6">
            <div className="grid grid-cols-5 gap-2.5">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.name)}
                  className={`h-9 rounded-xl transition-all duration-200 flex items-center justify-center ${
                    selectedColor === color.name
                      ? `${color.class} ring-2 ${color.ring} ring-offset-2 ring-offset-background shadow-lg`
                      : `${color.class}/60 hover:${color.class} hover:scale-110`
                  }`}
                >
                  {selectedColor === color.name && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="p-4 pt-3 border-t border-border/50 bg-muted/20 flex-row gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-xs rounded-lg"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function UserSettingsDialog({ open, onOpenChange, currentUser, onUpdateProfile, onUpdateStatusMessage }: UserSettingsDialogProps) {
  const handleSave = useCallback((displayName: string, sound: boolean, desktopNotifications: boolean, selectedColor: string, statusMessage: string, selectedWallpaper: WallpaperOption) => {
    if (!currentUser) return

    // Save display name via API
    if (displayName.trim() && displayName !== currentUser.displayName) {
      onUpdateProfile(currentUser.id, displayName.trim())
    }

    // Save notification settings
    saveSettings({ sound, desktopNotifications })

    // Save avatar color
    saveAvatarColor(selectedColor)

    // Save wallpaper
    saveWallpaper(selectedWallpaper)

    // Save status message
    try {
      localStorage.setItem('lanchat-status-message', statusMessage)
    } catch {}
    if (onUpdateStatusMessage) {
      onUpdateStatusMessage(currentUser.id, statusMessage)
    }

    // Dispatch custom event for wallpaper change
    window.dispatchEvent(new CustomEvent('lanchat:wallpaper-changed', { detail: { wallpaper: selectedWallpaper } }))

    onOpenChange(false)
  }, [currentUser, onUpdateProfile, onUpdateStatusMessage, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && currentUser && (
        <SettingsForm
          key={currentUser.id}
          currentUser={currentUser}
          onSave={handleSave}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}
