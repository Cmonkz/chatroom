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
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [nickname, setNickname] = useState(
    user.user_metadata?.nickname || user.email?.split('@')[0] || 'User'
  )
  const [tempNickname, setTempNickname] = useState(nickname)

  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const router = useRouter()

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveNickname = async () => {
    const newNickname = tempNickname.trim()
    if (!newNickname) return

    const { error } = await supabase.auth.updateUser({
      data: { nickname: newNickname },
    })

    if (error) {
      alert('Failed to update nickname')
      return
    }

    setNickname(newNickname)
    setIsEditingNickname(false)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const content = input.trim()
    setInput('')

    const { error } = await supabase.from('messages').insert({
      content,
      username: nickname,
      user_id: user.id,
    })

    if (error) {
      console.error(error)
      alert('Failed to send message')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="font-semibold text-lg text-gray-800">Tabi</h1>

        <div className="flex items-center gap-3">
          {isEditingNickname ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={20}
                autoFocus
              />
              <button
                onClick={saveNickname}
                className="text-sm text-green-600 font-medium hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingNickname(false)
                  setTempNickname(nickname)
                }}
                className="text-sm text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700">{nickname}</span>
              <button
                onClick={() => setIsEditingNickname(true)}
                className="text-gray-400 hover:text-blue-600 transition"
                title="Edit nickname"
              >
                ✎
              </button>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.username === nickname

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 rounded-bl-md'
                }`}
              >
                {!isMe && (
                  <p className="text-xs font-semibold mb-1 opacity-70">
                    {msg.username}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p
                  className={`text-[11px] mt-1 ${
                    isMe ? 'text-blue-100' : 'text-gray-400'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t px-4 py-3">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}