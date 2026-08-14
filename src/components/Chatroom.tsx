'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  content: string
  username: string
  created_at: string
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load initial messages + subscribe to new ones
  useEffect(() => {
    // 1. Load existing messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setMessages(data)
      setLoading(false)
    }

    loadMessages()

    // 2. Subscribe to new messages (Realtime)
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
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    // Cleanup when component unmounts
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !username.trim()) return

    const content = input.trim()
    setInput('')

    const { error } = await supabase.from('messages').insert({
      content,
      username: username.trim(),
    })

    if (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    }
  }

  if (loading) return <div className="p-8">Loading chat...</div>

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Username input */}
      <div className="p-4 border-b">
        <input
          type="text"
          placeholder="Your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          
          <div key={msg.id}>
            <div className="font-semibold text-xs text-blue-600">{msg.username}</div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className='text-gray-500'>{msg.content}</div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(msg.created_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
          disabled={!username.trim()}
        />
        <button
          type="submit"
          disabled={!input.trim() || !username.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}