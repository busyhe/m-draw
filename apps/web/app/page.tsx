'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users } from 'lucide-react'
import { useTotalUsers } from '@/hooks'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export default function HomePage() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const totalUsers = useTotalUsers()

  const createRoom = () => {
    const id = crypto.randomUUID()
    router.push(`/room/${id}`)
  }

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`)
    }
  }

  return (
    <div data-wrapper="" className="border-grid flex flex-1 flex-col min-h-svh">
      <SiteHeader />
      <main className="flex flex-1 flex-col container-wrapper">
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">tldraw Collaborative</h1>
              <p className="text-gray-500">Create a new whiteboard or join an existing session.</p>
              {totalUsers !== null && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Users size={16} />
                  <span>
                    {totalUsers} user{totalUsers !== 1 ? 's' : ''} online
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={createRoom}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              <Plus size={20} />
              Create New Room
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or join existing</span>
              </div>
            </div>

            <form onSubmit={joinRoom} className="space-y-4">
              <div>
                <label htmlFor="roomId" className="sr-only">
                  Room ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Users size={18} />
                  </div>
                  <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!roomId.trim()}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
