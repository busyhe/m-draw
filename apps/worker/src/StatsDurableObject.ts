export interface StatsEnv {
  STATS_DURABLE_OBJECT: DurableObjectNamespace
}

// Storage keys for room stats (persisted)
const STORAGE_KEYS = {
  TOTAL_USERS: 'totalUsers',
  ROOM_USERS: 'roomUsers'
} as const

// Visitor heartbeat timeout (30 seconds)
const VISITOR_TIMEOUT_MS = 30000

// JSON response helper without CORS headers (handled by main router)
const jsonResponse = (data: object, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export class StatsDurableObject implements DurableObject {
  // Room stats (persisted) - users currently in rooms
  private totalUsers: number = 0
  private roomUsers: Map<string, number> = new Map()
  private initialized: boolean = false

  // Visitor stats (in-memory) - all website visitors with heartbeat
  private visitors: Map<string, number> = new Map()

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: StatsEnv
  ) {
    // Load persisted state on initialization
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState()
    })
  }

  private async loadState(): Promise<void> {
    if (this.initialized) return

    const [totalUsers, roomUsersObj] = await Promise.all([
      this.state.storage.get<number>(STORAGE_KEYS.TOTAL_USERS),
      this.state.storage.get<Record<string, number>>(STORAGE_KEYS.ROOM_USERS)
    ])

    this.totalUsers = totalUsers ?? 0
    this.roomUsers = new Map(Object.entries(roomUsersObj ?? {}))
    this.initialized = true
  }

  private async saveState(): Promise<void> {
    await this.state.storage.put({
      [STORAGE_KEYS.TOTAL_USERS]: this.totalUsers,
      [STORAGE_KEYS.ROOM_USERS]: Object.fromEntries(this.roomUsers)
    })
  }

  // Get active visitor count (exclude expired heartbeats)
  private getActiveVisitorCount(): number {
    const now = Date.now()
    let count = 0
    for (const [visitorId, lastHeartbeat] of this.visitors) {
      if (now - lastHeartbeat < VISITOR_TIMEOUT_MS) {
        count++
      } else {
        // Cleanup expired visitor
        this.visitors.delete(visitorId)
      }
    }
    return count
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET') {
      // Get total online visitors (heartbeat-based)
      if (url.pathname === '/stats/total') {
        return jsonResponse({ total: this.getActiveVisitorCount() })
      }

      // Get users in a specific room
      if (url.pathname === '/stats/room') {
        const roomId = url.searchParams.get('roomId')
        if (!roomId) {
          return jsonResponse({ error: 'Missing roomId' }, 400)
        }
        const count = this.roomUsers.get(roomId) || 0
        return jsonResponse({ count })
      }
    }

    if (request.method === 'POST') {
      const action = url.searchParams.get('action')

      // Handle visitor heartbeat
      if (action === 'heartbeat') {
        const visitorId = url.searchParams.get('visitorId')
        if (!visitorId) {
          return jsonResponse({ error: 'Missing visitorId' }, 400)
        }
        this.visitors.set(visitorId, Date.now())
        return jsonResponse({ success: true, total: this.getActiveVisitorCount() })
      }

      // Handle room connect/disconnect (original logic)
      const roomId = url.searchParams.get('roomId')
      if (action === 'connect') {
        this.totalUsers++
        if (roomId) {
          this.roomUsers.set(roomId, (this.roomUsers.get(roomId) || 0) + 1)
        }
        await this.saveState()
      } else if (action === 'disconnect') {
        this.totalUsers = Math.max(0, this.totalUsers - 1)
        if (roomId) {
          const current = this.roomUsers.get(roomId) || 0
          if (current > 0) {
            this.roomUsers.set(roomId, current - 1)
          }
        }
        await this.saveState()
      }

      return jsonResponse({ success: true })
    }

    return new Response('Not found', { status: 404 })
  }
}
