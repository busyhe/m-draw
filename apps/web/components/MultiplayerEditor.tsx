'use client'

import { Tldraw, TLAsset } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Users, Copy, Check, Home } from 'lucide-react'
import { WORKER_URL, TLDRAW_LICENSE_KEY } from '@/lib/constants'
import { useRoomUsers } from '@/hooks'
import { useRouter } from 'next/navigation'

// Confirm dialog component using native <dialog> element
function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-9999 m-auto w-80 rounded-xl bg-white p-6 shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Confirm
        </button>
      </div>
    </dialog>
  )
}

function SyncedEditor({ roomId }: { roomId: string }) {
  const syncConfig = useMemo(
    () => ({
      uri: `${WORKER_URL}/connect/${roomId}`,
      assets: {
        upload: async (_asset: TLAsset, file: File) => {
          const id = crypto.randomUUID()
          const response = await fetch(`${WORKER_URL}/assets/${id}`, {
            method: 'POST',
            body: file,
            headers: { 'Content-Type': file.type }
          })
          if (!response.ok) {
            throw new Error(`Failed to upload asset: ${response.statusText}`)
          }
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
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const roomUsers = useRoomUsers(roomId, { enabled: isMounted })
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleConfirmLeave = useCallback(() => {
    router.push('/')
  }, [router])

  if (!isMounted) {
    return <div style={{ position: 'fixed', inset: 0 }} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {roomUsers !== null && (
        <div className="absolute top-1 right-2 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-[1000] flex items-center gap-1 sm:gap-3 bg-white/90 backdrop-blur-md px-1 sm:px-1.5 py-1 rounded-full shadow-sm border border-gray-200/50 hover:shadow-md transition-all">
          <button
            onClick={() => setShowLeaveDialog(true)}
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-900 cursor-pointer"
            title="Back to Home"
          >
            <Home size={14} className="sm:hidden" />
            <Home size={16} className="hidden sm:block" />
          </button>
          <div className="w-px h-3 bg-gray-200" />
          <div className="flex items-center gap-1 sm:gap-2 px-1">
            <Users size={12} className="text-gray-500 sm:hidden" />
            <Users size={14} className="text-gray-500 hidden sm:block" />
            <span className="text-xs sm:text-sm font-medium text-gray-700">{roomUsers}</span>
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 sm:gap-2 hover:bg-gray-100 p-1 sm:p-1.5 -my-1 rounded-full transition-colors group cursor-pointer"
            title="Copy Room ID"
          >
            <span className="hidden sm:inline text-xs text-gray-400 font-mono max-w-[100px] truncate">
              ID: {roomId}
            </span>
            {isCopied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className="text-gray-400 group-hover:text-gray-600" />
            )}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={showLeaveDialog}
        title="Leave Room"
        description="Are you sure you want to leave this room and go back to the home page?"
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowLeaveDialog(false)}
      />
      <SyncedEditor roomId={roomId} />
    </div>
  )
}
