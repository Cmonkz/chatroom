'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type Message = {
  id: string
  content: string
  username: string
  user_id: string | null
  created_at: string
  reply_to: string | null
}

type Reaction = {
  id: string
  message_id: string
  user_id: string
  emoji: string
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡']

export default function ChatRoom({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [nickname, setNickname] = useState(
    user.user_metadata?.nickname || user.email?.split('@')[0] || 'User'
  )
  const [tempNickname, setTempNickname] = useState(nickname)
  const [activeReactionMessage, setActiveReactionMessage] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)

      const { data: reactionsData } = await supabase
        .from('message_reactions')
        .select('*')

      if (messagesData) setMessages(messagesData)
      if (reactionsData) setReactions(reactionsData)
      setLoading(false)
    }

    loadData()

    const messageChannel = supabase
      .channel('global-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    const reactionChannel = supabase
      .channel('reactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as Reaction
            setReactions((prev) => {
              if (prev.some((r) => r.id === newReaction.id)) return prev
              return [...prev, newReaction]
            })
          }
          if (payload.eventType === 'DELETE') {
            setReactions((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(reactionChannel)
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
      reply_to: replyingTo ? replyingTo.id : null,
    })

    if (error) {
      console.error(error)
      alert('Failed to send message')
    }

    setReplyingTo(null)
  }

  const startReply = (message: Message) => {
    setReplyingTo(message)
    setActiveReactionMessage(null)
    inputRef.current?.focus()
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    const existing = reactions.find(
      (r) =>
        r.message_id === messageId &&
        r.user_id === user.id &&
        r.emoji === emoji
    )

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      })
    }

    setActiveReactionMessage(null)
  }

  const getReactionsForMessage = (messageId: string) => {
    const messageReactions = reactions.filter((r) => r.message_id === messageId)
    const grouped: Record<string, { count: number; reactedByMe: boolean }> = {}

    messageReactions.forEach((r) => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { count: 0, reactedByMe: false }
      }
      grouped[r.emoji].count++
      if (r.user_id === user.id) {
        grouped[r.emoji].reactedByMe = true
      }
    })

    return grouped
  }

  const getReplyMessage = (replyToId: string | null) => {
    if (!replyToId) return null
    return messages.find((m) => m.id === replyToId) || null
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-lg text-gray-800">Chat Room</h1>

        <div className="flex items-center gap-3">
          {isEditingNickname ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={20}
                autoFocus
              />
              <button onClick={saveNickname} className="text-sm text-green-600 font-medium hover:underline">
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

          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-600 font-medium">
            Logout
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const isMe = msg.user_id === user.id
          const messageReactions = getReactionsForMessage(msg.id)
          const repliedMessage = getReplyMessage(msg.reply_to)

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="relative max-w-[75%] group">
                {/* Reply preview (the message this one is replying to) */}
                {repliedMessage && (
                  <div
                    className={`mb-1 px-3 py-1.5 rounded-lg text-xs border-l-4 ${
                      isMe
                        ? 'bg-blue-500/20 border-blue-300 text-blue-100'
                        : 'bg-gray-100 border-gray-400 text-gray-600'
                    }`}
                  >
                    <p className="font-semibold">{repliedMessage.username}</p>
                    <p className="truncate opacity-80">{repliedMessage.content}</p>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md'
                  }`}
                >
                  {!isMe && (
                    <p className="text-xs font-semibold mb-1 opacity-70">{msg.username}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[11px] mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Reactions */}
                {Object.keys(messageReactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(messageReactions).map(([emoji, data]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          data.reactedByMe
                            ? 'bg-blue-100 border-blue-300'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        {emoji} {data.count}
                      </button>
                    ))}
                  </div>
                )}

                {/* Action buttons (Reply + React) */}
                <div
                  className={`absolute -bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition ${
                    isMe ? 'left-0' : 'right-0'
                  }`}
                >
                  <button
                    onClick={() => startReply(msg)}
                    className="text-md text-gray-500 bg-white rounded-full px-1.5 py-0.5 shadow-sm hover:bg-gray-50"
                  >
                    ↩
                  </button>
                  <button
                    onClick={() =>
                      setActiveReactionMessage(activeReactionMessage === msg.id ? null : msg.id)
                    }
                    className="text-md bg-white rounded-full px-1.5 py-0.5 shadow-sm hover:bg-gray-50"
                  >
                    😊
                  </button>
                </div>

                {/* Emoji picker */}
                {activeReactionMessage === msg.id && (
                  <div
                    className={`absolute bottom-8 bg-white border rounded-full shadow-lg px-2 py-1 flex gap-1 z-10 ${
                      isMe ? 'right-0' : 'left-0'
                    }`}
                  >
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className="hover:scale-125 transition text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="bg-gray-100 border-t px-4 py-2 flex items-center justify-between">
          <div className="text-sm">
            <p className="text-xs text-gray-500">Replying to <span className="font-medium">{replyingTo.username}</span></p>
            <p className="text-gray-700 truncate max-w-xs">{replyingTo.content}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t px-4 py-3">
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={replyingTo ? 'Write a reply...' : 'Type a message...'}
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