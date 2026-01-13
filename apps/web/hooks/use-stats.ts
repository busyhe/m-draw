'use client'

import { useState, useEffect, useCallback } from 'react'
import { WORKER_URL } from '@/lib/constants'
import type { TotalUsersResponse, RoomUsersResponse } from '@/lib/types'

interface UsePollingOptions {
  interval?: number
  enabled?: boolean
}

/**
 * Hook for fetching total online users count
 */
export function useTotalUsers(options: UsePollingOptions = {}) {
  const { interval = 3000, enabled = true } = options
  const [totalUsers, setTotalUsers] = useState<number | null>(null)

  const fetchTotalUsers = useCallback(async () => {
    try {
      const response = await fetch(`${WORKER_URL}/stats/total`)
      const data: TotalUsersResponse = await response.json()
      setTotalUsers(data.total)
    } catch (error) {
      console.error('Failed to fetch total users:', error)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    fetchTotalUsers()
    const timer = setInterval(fetchTotalUsers, interval)
    return () => clearInterval(timer)
  }, [enabled, interval, fetchTotalUsers])

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
