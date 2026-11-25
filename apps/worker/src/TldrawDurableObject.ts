import { TLSocketRoom, type RoomSnapshot } from '@tldraw/sync-core'

const PENDING_SNAPSHOT = 'pending-room-snapshot'
const SNAPSHOT_CHUNK_SIZE = 128 * 1024
const FLUSH_DELAY_MS = 1000
const RETRY_DELAY_MS = 5000
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000

type PendingSnapshot = { revision: number; chunkCount: number; failureCount?: number }

export interface Env {
  R2_BUCKET: R2Bucket
  TLDRAW_DURABLE_OBJECT: DurableObjectNamespace
  STATS_DURABLE_OBJECT: DurableObjectNamespace
}

export class TldrawDurableObject implements DurableObject {
  private room!: TLSocketRoom
  private snapshotDirty = false
  private revision = 0
  private flushing = false

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env
  ) {
    // Recover once per object instance, before accepting any socket. Never
    // open an empty room if reading its existing snapshot failed.
    this.state.blockConcurrencyWhile(async () => {
      const pending = await this.readPendingSnapshot()
      const saved = pending?.snapshot ? null : await this.env.R2_BUCKET.get(this.snapshotKey)
      const initialSnapshot = pending?.snapshot
        ? (JSON.parse(pending.snapshot) as RoomSnapshot)
        : await saved?.json<RoomSnapshot>()
      this.revision = pending?.revision ?? 0
      // Re-arm if the instance stopped while handling a previously delivered alarm.
      if (pending?.snapshot) await this.state.storage.setAlarm(Date.now() + FLUSH_DELAY_MS)

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

  private getSnapshotChunkKey(index: number) {
    return `${PENDING_SNAPSHOT}/${index}`
  }

  private async readPendingSnapshot() {
    return this.state.storage.transaction(async (tx) => {
      const pending = await tx.get<PendingSnapshot>(PENDING_SNAPSHOT)
      if (!pending) return null
      if (pending.chunkCount === 0) return { revision: pending.revision, snapshot: null }

      const chunks: string[] = []
      for (let i = 0; i < pending.chunkCount; i++) {
        const chunk = await tx.get<string>(this.getSnapshotChunkKey(i))
        if (chunk === undefined) throw new Error('Missing pending room snapshot chunk')
        chunks.push(chunk)
      }
      return { revision: pending.revision, snapshot: chunks.join('') }
    })
  }

  private scheduleSnapshotSave() {
    if (!this.room) {
      this.snapshotDirty = true
      return
    }
    this.snapshotDirty = false
    // Persist before relying on the R2 uploader. The alarm and its data commit together.
    const revision = ++this.revision
    const snapshot = JSON.stringify(this.room.getCurrentSnapshot())
    this.state.waitUntil(this.stageSnapshot(revision, snapshot))
  }

  private async stageSnapshot(revision: number, snapshot: string) {
    await this.state.storage.transaction(async (tx) => {
      const previous = await tx.get<PendingSnapshot>(PENDING_SNAPSHOT)
      if (previous && previous.revision >= revision) return

      // Store bounded chunks rather than assuming a drawing fits in one storage value.
      const chunkCount = Math.ceil(snapshot.length / SNAPSHOT_CHUNK_SIZE)
      for (let i = 0; i < chunkCount; i++) {
        const start = i * SNAPSHOT_CHUNK_SIZE
        await tx.put(this.getSnapshotChunkKey(i), snapshot.slice(start, start + SNAPSHOT_CHUNK_SIZE))
      }
      for (let i = chunkCount; i < (previous?.chunkCount ?? 0); i++) {
        await tx.delete(this.getSnapshotChunkKey(i))
      }
      await tx.put<PendingSnapshot>(PENDING_SNAPSHOT, { revision, chunkCount, failureCount: previous?.failureCount })
      if ((await tx.getAlarm()) === null) await tx.setAlarm(Date.now() + FLUSH_DELAY_MS)
    })
  }

  async alarm() {
    if (this.flushing) {
      await this.state.storage.setAlarm(Date.now() + FLUSH_DELAY_MS)
      return
    }
    this.flushing = true
    try {
      const pending = await this.readPendingSnapshot()
      if (!pending?.snapshot) return

      try {
        await this.env.R2_BUCKET.put(this.snapshotKey, pending.snapshot)
      } catch (error) {
        console.error('Failed to save room snapshot to R2:', this.state.id.toString(), error)
        await this.state.storage.transaction(async (tx) => {
          const current = await tx.get<PendingSnapshot>(PENDING_SNAPSHOT)
          if (!current?.chunkCount) return
          const failureCount = Math.min((current.failureCount ?? 0) + 1, 7)
          const delay = Math.min(RETRY_DELAY_MS * 2 ** (failureCount - 1), MAX_RETRY_DELAY_MS)
          await tx.put<PendingSnapshot>(PENDING_SNAPSHOT, { ...current, failureCount })
          await tx.setAlarm(Date.now() + delay)
        })
        return
      }

      await this.state.storage.transaction(async (tx) => {
        const current = await tx.get<PendingSnapshot>(PENDING_SNAPSHOT)
        if (!current) return
        if (current.revision === pending.revision) {
          for (let i = 0; i < current.chunkCount; i++) await tx.delete(this.getSnapshotChunkKey(i))
          // Keep the high-water mark so a delayed writer cannot restore an older revision.
          await tx.put<PendingSnapshot>(PENDING_SNAPSHOT, { revision: current.revision, chunkCount: 0 })
        } else if ((await tx.getAlarm()) === null) {
          // Changes arrived during upload; the newer snapshot is still pending.
          await tx.setAlarm(Date.now() + FLUSH_DELAY_MS)
        }
      })
    } finally {
      this.flushing = false
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
