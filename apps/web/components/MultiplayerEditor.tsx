'use client'

import { Tldraw, TLAsset } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import { useEffect, useState, useMemo } from 'react'
import { Users } from 'lucide-react'
import { WORKER_URL, TLDRAW_LICENSE_KEY } from '@/lib/constants'
import { useRoomUsers } from '@/hooks'

function SyncedEditor({ roomId }: { roomId: string }) {
  const syncConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: {
        upload: async (_asset: TLAsset, file: File) => {
          const id = crypto.randomUUID()
          await fetch(`${WORKER_URL}/assets/${id}`, {
            method: 'POST',
            body: file,
            headers: { 'Content-Type': file.type }
          })
          return { src: `${WORKER_URL}/assets/${id}` }
        },
        resolve: (asset: TLAsset) => ('src' in asset.props ? asset.props.src : null) ?? ''
      }
    }),
    [roomId]
  )

  const syncStore = useSync(syncConfig)

  return <Tldraw store={syncStore} licenseKey={TLDRAW_LICENSE_KEY} />
}

export function MultiplayerEditor({ roomId }: { roomId: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const roomUsers = useRoomUsers(roomId, { enabled: isMounted })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div style={{ position: 'fixed', inset: 0 }} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {roomUsers !== null && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200">
          <Users size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">{roomUsers}</span>
        </div>
      )}
      <SyncedEditor roomId={roomId} />
    </div>
  )
}
