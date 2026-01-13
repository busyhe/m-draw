import { TLSocketRoom } from '@tldraw/sync-core'

export interface Env {
  R2_BUCKET: R2Bucket
  TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
  STATS_DURABLE_OBJECT: DurableObjectNamespace
}

export class TldrawDurableObject implements DurableObject {
  private room: TLSocketRoom

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    this.room = new TLSocketRoom({
      maxConnections: 100,
      log: {
        warn: (...args) => console.warn('TLSocketRoom Warn:', ...args),
        error: (...args) => console.error('TLSocketRoom Error:', ...args)
      },
      onSave: async (snapshot) => {
        await this.env.R2_BUCKET.put(`rooms/${this.state.id.toString()}`, JSON.stringify(snapshot))
      }
    })
  }

  private async notifyStats(action: 'connect' | 'disconnect', roomId: string) {
    try {
      const statsId = this.env.STATS_DURABLE_OBJECT.idFromName('global')
      const statsObj = this.env.STATS_DURABLE_OBJECT.get(statsId)
      await statsObj.fetch(
        new Request(`http://localhost/stats?action=${action}&roomId=${encodeURIComponent(roomId)}`, {
          method: 'POST'
        })
      )
    } catch (e) {
      console.error('Failed to notify stats:', e)
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      // Handle websocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        const pair = new WebSocketPair()
        const client = pair[0]
        const server = pair[1]

        const sessionId = new URL(request.url).searchParams.get('sessionId')
        if (!sessionId) {
          return new Response('Missing sessionId', { status: 400 })
        }

        const url = new URL(request.url)
        const roomId = url.searchParams.get('_roomId') || this.state.id.toString()

        console.log(`Connecting to room ${roomId} session ${sessionId}`)

        // Recover room state from R2 if needed
        try {
          const sessions = this.room.getSessions()
          if (sessions.length === 0) {
            const saved = await this.env.R2_BUCKET.get(`rooms/${this.state.id.toString()}`)
            if (saved) {
              const snapshot = await saved.json()
              this.room.loadSnapshot(snapshot)
              console.log(`Recovered snapshot for room ${this.state.id.toString()}`)
            } else {
              console.log('No saved room state found in R2')
            }
          }
        } catch (e) {
          console.error(`Failed to recover room state:`, e)
        }

        server.accept()
        console.log('WebSocket accepted, handling connection...')

        // Notify stats on connect
        await this.notifyStats('connect', roomId)

        // Handle disconnect
        server.addEventListener('close', async (evt) => {
          console.log('DEBUG: Socket closed', evt.code, evt.reason)
          await this.notifyStats('disconnect', roomId)
        })
        server.addEventListener('error', async (err) => {
          console.error('DEBUG: Socket error:', err)
          await this.notifyStats('disconnect', roomId)
        })

        // DEBUG: Monitor socket events to diagnose TLSocketRoom behavior
        server.addEventListener('message', (event) => {
          console.log('DEBUG: Socket received message size:', (event.data as string | ArrayBuffer).toString().length)
        })

        // this.room.handleSocketConnect({ sessionId, socket: socketProxy })
        try {
          this.room.handleSocketConnect({ sessionId, socket: server })
          console.log('Connection handled by TLSocketRoom')
        } catch (e) {
          console.error('TLSocketRoom handleSocketConnect error:', e)
          await this.notifyStats('disconnect', roomId)
          return new Response('Sync Error', { status: 500 })
        }

        return new Response(null, { status: 101, webSocket: client })
      }

      return new Response('Not found', { status: 404 })
    } catch (error) {
      console.error('Durable Object Error:', error)
      return new Response(error instanceof Error ? error.message : 'Internal Server Error', { status: 500 })
    }
  }
}
