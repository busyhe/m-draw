import { TLSocketRoom, type RoomSnapshot } from '@tldraw/sync-core'

export interface Env {
  R2_BUCKET: R2Bucket
  TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
  STATS_DURABLE_OBJECT: DurableObjectNamespace
}

export class TldrawDurableObject implements DurableObject {
  private room!: TLSocketRoom
  private snapshotDirty = false
  private savingSnapshot = false

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    // Recover once per object instance, before accepting any socket. Never
    // open an empty room if reading its existing snapshot failed.
    this.state.blockConcurrencyWhile(async () => {
      const saved = await this.env.R2_BUCKET.get(this.snapshotKey)
      const initialSnapshot = saved ? await saved.json<RoomSnapshot>() : undefined

      this.room = new TLSocketRoom({
        initialSnapshot,
        log: {
          warn: (...args) => console.warn('TLSocketRoom Warn:', ...args),
          error: (...args) => console.error('TLSocketRoom Error:', ...args)
        },
        onDataChange: () => this.scheduleSnapshotSave()
      })
      // tldraw can report a migration during construction, when room isn't assigned yet.
      if (this.snapshotDirty) this.scheduleSnapshotSave()
    })
  }

  private get snapshotKey() {
    return `rooms/${this.state.id.toString()}`
  }

  private scheduleSnapshotSave() {
    this.snapshotDirty = true
    if (!this.room || this.savingSnapshot) return

    this.savingSnapshot = true
    this.state.waitUntil(this.flushSnapshots())
  }

  private async flushSnapshots() {
    try {
      // Serialize writes so a slow older snapshot cannot replace a newer one.
      // Edits while a write is in flight are coalesced into the next snapshot.
      while (this.snapshotDirty) {
        this.snapshotDirty = false
        const snapshot = JSON.stringify(this.room.getCurrentSnapshot())
        for (let attempt = 0; ; attempt++) {
          try {
            await this.env.R2_BUCKET.put(this.snapshotKey, snapshot)
            break
          } catch (error) {
            if (attempt === 2) throw error
            await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt))
          }
        }
      }
    } catch (error) {
      this.snapshotDirty = true
      console.error('Failed to save room snapshot:', this.state.id.toString(), error)
    } finally {
      this.savingSnapshot = false
    }
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

        server.accept()

        // Notify stats on connect
        await this.notifyStats('connect', roomId)

        // Handle disconnect
        server.addEventListener('close', async () => {
          await this.notifyStats('disconnect', roomId)
        })
        server.addEventListener('error', async () => {
          await this.notifyStats('disconnect', roomId)
        })

        try {
          this.room.handleSocketConnect({ sessionId, socket: server })
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
