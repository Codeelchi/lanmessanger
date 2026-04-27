'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Types matching the API responses from /api/lan-users and /api/lan-status
export interface LANUser {
  id: string
  name: string
  address: string
  version: string
  status: string
  note: string
  caps: string
  avatar: string
  ip: string
  port: number
  lastSeen: string
  protocol: string
}

export interface LANStatus {
  running: boolean
  userId: string | null
  userName: string | null
  ipAddress: string | null
  udpPort: number
  multicastGroup: string
  userCount: number
  uptime: number
}

interface UseLANUsersReturn {
  lanUsers: LANUser[]
  lanStatus: LANStatus | null
  isBridgeRunning: boolean
  isLoading: boolean
  refetch: () => void
}

const POLL_INTERVAL = 10_000 // 10 seconds
const EMPTY_STATUS: LANStatus = {
  running: false,
  userId: null,
  userName: null,
  ipAddress: null,
  udpPort: 0,
  multicastGroup: '239.255.100.100',
  userCount: 0,
  uptime: 0,
}

export function useLANUsers(enabled = true): UseLANUsersReturn {
  const [lanUsers, setLanUsers] = useState<LANUser[]>([])
  const [lanStatus, setLanStatus] = useState<LANStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const enabledRef = useRef(enabled)

  // Keep ref in sync
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const fetchData = useCallback(async () => {
    if (!enabledRef.current) return

    try {
      // Fetch LAN users and status in parallel
      const [usersRes, statusRes] = await Promise.allSettled([
        fetch('/api/lan-users'),
        fetch('/api/lan-status'),
      ])

      // Process LAN users
      if (usersRes.status === 'fulfilled') {
        const usersData = await usersRes.value.json()
        if (usersData.success) {
          setLanUsers(usersData.data || [])
        }
      }

      // Process LAN status
      if (statusRes.status === 'fulfilled') {
        const statusData = await statusRes.value.json()
        if (statusData.success) {
          setLanStatus(statusData.data || EMPTY_STATUS)
        }
      }
    } catch {
      // Silently fail — bridge is likely not running
      setLanUsers([])
      setLanStatus(EMPTY_STATUS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refetch = useCallback(() => {
    setIsLoading(true)
    fetchData()
  }, [fetchData])

  // Initial fetch + polling
  useEffect(() => {
    if (!enabled) {
      return
    }

    const fetchTimer = setTimeout(fetchData, 0)

    intervalRef.current = setInterval(fetchData, POLL_INTERVAL)

    return () => {
      clearTimeout(fetchTimer)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, fetchData])

  return {
    lanUsers,
    lanStatus,
    isBridgeRunning: lanStatus?.running ?? false,
    isLoading: enabled ? isLoading : false,
    refetch,
  }
}
