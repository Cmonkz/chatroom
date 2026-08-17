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

type Room = {
  id: string
  name: string
  description: string | null
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡']

export default function ChatRoom({ user, room }: { user: User; room: Room }) {
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
        .eq('room_id', room.id)
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
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}`, },
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
      room_id: room.id,
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
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
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
      if (r.user_id === user.id) grouped[r.emoji].reactedByMe = true
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
      <div className="h-full flex items-center justify-center bg-[#313338]">
        <p className="text-gray-400">Loading chat...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#313338] text-gray-100">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">#</span>
          <h1 className="font-semibold text-white">{room.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          {isEditingNickname ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                className="bg-[#1e1f22] border border-[#1e1f22] rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={20}
                autoFocus
              />
              <button onClick={saveNickname} className="text-sm text-green-400 hover:underline">
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingNickname(false)
                  setTempNickname(nickname)
                }}
                className="text-sm text-gray-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-300">{nickname}</span>
              <button
                onClick={() => setIsEditingNickname(true)}
                className="text-gray-500 hover:text-gray-300 transition"
                title="Edit nickname"
              >
                ✎
              </button>
            </div>
          )}

          <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">
            Logout
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.user_id === user.id
          const messageReactions = getReactionsForMessage(msg.id)
          const repliedMessage = getReplyMessage(msg.reply_to)

          return (
            <div key={msg.id} className="group relative hover:bg-[#2e3035] px-2 py-1 rounded">
              {/* Reply preview */}
              {repliedMessage && (
                <div className="flex items-center gap-1 mb-1 text-xs text-gray-400 ml-10 border-l-2 border-gray-600 pl-2">
                  <span className="font-medium text-gray-300">{repliedMessage.username}</span>
                  <span className="truncate max-w-xs">{repliedMessage.content}</span>
                </div>
              )}

              <div className="flex gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-medium text-white flex-shrink-0 mt-0.5">
                  {msg.username.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-medium text-sm ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                      {msg.username}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-gray-100 text-sm leading-relaxed mt-0.5 break-words">
                    {msg.content}
                  </p>

                  {/* Reactions */}
                  {Object.keys(messageReactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(messageReactions).map(([emoji, data]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`text-xs px-1.5 py-0.5 rounded-full border ${
                            data.reactedByMe
                              ? 'bg-indigo-500/30 border-indigo-400'
                              : 'bg-[#2b2d31] border-[#1e1f22] hover:border-gray-500'
                          }`}
                        >
                          {emoji} {data.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="absolute right-2 top-0 hidden group-hover:flex items-center gap-1 bg-[#2b2d31] border border-[#1e1f22] rounded shadow-sm">
                <button
                  onClick={() => startReply(msg)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-[#35373c] rounded"
                  title="Reply"
                >
                  ↩
                </button>
                <button
                  onClick={() =>
                    setActiveReactionMessage(activeReactionMessage === msg.id ? null : msg.id)
                  }
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-[#35373c] rounded"
                  title="Add Reaction"
                >
                  😊
                </button>
              </div>

              {/* Emoji picker */}
              {activeReactionMessage === msg.id && (
                <div className="absolute right-2 top-10 bg-[#2b2d31] border border-[#1e1f22] rounded-lg shadow-lg px-2 py-1.5 flex gap-1 z-10">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(msg.id, emoji)}
                      className="hover:scale-125 transition text-lg p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      {replyingTo && (
        <div className="bg-[#2b2d31] border-t border-[#1e1f22] px-4 py-2 flex items-center justify-between">
          <div className="text-sm">
            <p className="text-xs text-gray-400">
              Replying to <span className="text-indigo-300 font-medium">{replyingTo.username}</span>
            </p>
            <p className="text-gray-300 truncate max-w-md">{replyingTo.content}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white text-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <form onSubmit={sendMessage} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : 'Message #general'}
            className="w-full bg-[#383a40] text-gray-100 rounded-lg px-4 py-3 text-sm focus:outline-none placeholder:text-gray-500"
          />
        </form>
      </div>
    </div>
  )
}