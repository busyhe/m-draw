export interface StatsEnv {
  STATS_DURABLE_OBJECT: DurableObjectNamespace
}

export class StatsDurableObject implements DurableObject {
  private totalUsers: number = 0
  private roomUsers: Map<string, number> = new Map()

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: StatsEnv
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET') {
      if (url.pathname === '/stats/total') {
        return new Response(JSON.stringify({ total: this.totalUsers }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }

      if (url.pathname === '/stats/room') {
        const roomId = url.searchParams.get('roomId')
        if (!roomId) {
          return new Response(JSON.stringify({ error: 'Missing roomId' }), { status: 400 })
        }
        const count = this.roomUsers.get(roomId) || 0
        return new Response(JSON.stringify({ count }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
    }

    if (request.method === 'POST') {
      const action = url.searchParams.get('action')
      const roomId = url.searchParams.get('roomId')

      if (action === 'connect') {
        this.totalUsers++
        if (roomId) {
          this.roomUsers.set(roomId, (this.roomUsers.get(roomId) || 0) + 1)
        }
      } else if (action === 'disconnect') {
        this.totalUsers = Math.max(0, this.totalUsers - 1)
        if (roomId) {
          const current = this.roomUsers.get(roomId) || 0
          if (current > 0) {
            this.roomUsers.set(roomId, current - 1)
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response('Not found', { status: 404 })
  }
}
