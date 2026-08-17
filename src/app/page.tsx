'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ChatRoom from '@/components/Chatroom'
import Feed from '@/components/Feed'
import type { User } from '@supabase/supabase-js'

type Room = {
  id: string
  name: string
  description: string | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('chat')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1f22]">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#1e1f22] overflow-hidden">
      {/* Mobile Tabs */}
      <div className="flex md:hidden bg-[#2b2d31] border-b border-[#1e1f22]">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'feed'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-gray-400'
          }`}
        >
          Rooms
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'chat'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-gray-400'
          }`}
        >
          Chat
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`
            w-full md:w-60 lg:w-64 border-r border-[#1e1f22] overflow-y-auto
            ${activeTab === 'feed' ? 'block' : 'hidden'} md:block
          `}
        >
          <Feed
            user={user}
            selectedRoomId={selectedRoom?.id || null}
            onSelectRoom={(room) => {
              setSelectedRoom(room)
              setActiveTab('chat') // on mobile, switch to chat after selecting room
            }}
          />
        </div>

        {/* Chat */}
        <div
          className={`
            flex-1 flex flex-col
            ${activeTab === 'chat' ? 'flex' : 'hidden'} md:flex
          `}
        >
          {selectedRoom ? (
            <ChatRoom user={user} room={selectedRoom} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a room to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  )
}