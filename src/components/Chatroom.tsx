'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type Message = {
  id: string
  content: string
  username: string
  created_at: string
}

export default function ChatRoom({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // Get display name from the logged-in user
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  // Load messages + subscribe
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)

      if (data) setMessages(data)
      setLoading(false)
    }

    loadMessages()

    const channel = supabase
      .channel('global-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const content = input.trim()
    setInput('')

    const { error } = await supabase.from('messages').insert({
      content,
      username: displayName,
      user_id: user.id,
    })

    if (error) {
      console.error(error)
      alert('Failed to send message')
    }
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading chat...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-white">
        <h1 className="font-bold text-lg">Chat Room</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{displayName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3 max-w-[80%] ${
              msg.username === displayName
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-white border'
            }`}
          >
            <div className="font-semibold text-sm mb-1 opacity-80">{msg.username}</div>
            <div className="p-4 space-y-3 bg-gray-50">
              <div className="text-gray-500">{msg.content}</div>
              <div className="text-xs mt-1 opacity-70">
                {new Date(msg.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t bg-white flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}