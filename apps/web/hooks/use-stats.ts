'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { WORKER_URL } from '@/lib/constants'
import type { HeartbeatResponse, RoomUsersResponse } from '@/lib/types'

interface UsePollingOptions {
  interval?: number
  enabled?: boolean
}

// Storage key for visitor ID
const VISITOR_ID_KEY = 'm-draw-visitor-id'

// Get or create visitor ID
function getVisitorId(): string {
  if (typeof window === 'undefined') return ''

  let visitorId = localStorage.getItem(VISITOR_ID_KEY)
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, visitorId)
  }
  return visitorId
}

/**
 * Hook for tracking online visitors using heartbeat mechanism
 */
export function useTotalUsers(options: UsePollingOptions = {}) {
  const { interval = 10000, enabled = true } = options
  const [totalUsers, setTotalUsers] = useState<number | null>(null)
  const visitorIdRef = useRef<string>('')

  // Initialize visitor ID on client side
  useEffect(() => {
    visitorIdRef.current = getVisitorId()
  }, [])

  const sendHeartbeat = useCallback(async () => {
    if (!visitorIdRef.current) return

    try {
      const response = await fetch(
        `${WORKER_URL}/stats/heartbeat?action=heartbeat&visitorId=${encodeURIComponent(visitorIdRef.current)}`,
        { method: 'POST' }
      )
      const data: HeartbeatResponse = await response.json()
      setTotalUsers(data.total)
    } catch (error) {
      console.error('Failed to send heartbeat:', error)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Send initial heartbeat after visitor ID is ready
    const initialTimeout = setTimeout(sendHeartbeat, 100)

    // Send periodic heartbeats
    const timer = setInterval(sendHeartbeat, interval)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(timer)
    }
  }, [enabled, interval, sendHeartbeat])

  return totalUsers
}

/**
 * Hook for fetching room users count
 */
export function useRoomUsers(roomId: string, options: UsePollingOptions = {}) {
  const { interval = 2000, enabled = true } = options
  const [roomUsers, setRoomUsers] = useState<number | null>(null)

  const fetchRoomUsers = useCallback(async () => {
    try {
      const response = await fetch(`${WORKER_URL}/stats/room?roomId=${encodeURIComponent(roomId)}`)
      const data: RoomUsersResponse = await response.json()
      setRoomUsers(data.count)
    } catch (error) {
      console.error('Failed to fetch room users:', error)
    }
  }, [roomId])

  useEffect(() => {
    if (!enabled) return

    fetchRoomUsers()
    const timer = setInterval(fetchRoomUsers, interval)
    return () => clearInterval(timer)
  }, [enabled, interval, fetchRoomUsers])

  return roomUsers
}
