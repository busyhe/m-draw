'use client'

import { Tldraw, TLAsset } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import { useEffect, useState, useMemo } from 'react'
import { Users, Copy, Check } from 'lucide-react'
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
  const [isCopied, setIsCopied] = useState(false)
  const roomUsers = useRoomUsers(roomId, { enabled: isMounted })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (!isMounted) {
    return <div style={{ position: 'fixed', inset: 0 }} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {roomUsers !== null && (
        <div className="absolute top-2 right-2 md:right-auto md:left-1/2 md:-translate-x-1/2 z-[1000] flex items-center gap-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-gray-200/50 hover:shadow-md transition-all">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{roomUsers}</span>
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 hover:bg-gray-100 p-1.5 -my-1 rounded-md transition-colors group cursor-pointer"
            title="Copy Room ID"
          >
            <span className="text-xs text-gray-400 font-mono max-w-[100px] truncate">ID: {roomId}</span>
            {isCopied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className="text-gray-400 group-hover:text-gray-600" />
            )}
          </button>
        </div>
      )}
      <SyncedEditor roomId={roomId} />
    </div>
  )
}
