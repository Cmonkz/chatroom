'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ChatRoom from '@/components/Chatroom'
import Feed from '@/components/Feed'
import type { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'feed' | 'chat'>('feed')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Mobile Tab Buttons */}
      <div className="flex md:hidden bg-white border-b">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'feed'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          }`}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'chat'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500'
          }`}
        >
          Chat
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Feed - Hidden on mobile unless active */}
        <div
          className={`
            w-full md:w-5/12 lg:w-4/12 border-r bg-white overflow-y-auto
            ${activeTab === 'feed' ? 'block' : 'hidden'} md:block
          `}
        >
          <Feed user={user} />
        </div>

        {/* Chat - Hidden on mobile unless active */}
        <div
          className={`
            flex-1 flex justify-center items-stretch md:items-end p-0 md:p-4 bg-gray-100
            ${activeTab === 'chat' ? 'flex' : 'hidden'} md:flex
          `}
        >
          <div className="w-full h-full md:max-w-md md:h-[85vh] md:shadow-xl md:rounded-2xl overflow-hidden">
            <ChatRoom user={user} />
          </div>
        </div>
      </div>
    </div>
  )
}