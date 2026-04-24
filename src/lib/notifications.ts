/**
 * Browser Desktop Notification utilities for LAN Chat
 */

export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  return Notification.requestPermission()
}

export function showNotification(
  title: string,
  options: NotificationOptions = {}
): globalThis.Notification | null {
  if (!isNotificationSupported()) return null
  if (Notification.permission !== 'granted') return null

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })

    // Focus window on click
    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    // Auto-close after 8 seconds
    setTimeout(() => {
      notification.close()
    }, 8000)

    return notification
  } catch {
    return null
  }
}

export function isDesktopNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const saved = localStorage.getItem('lanchat-settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.desktopNotifications === true
    }
  } catch {}
  return false
}
