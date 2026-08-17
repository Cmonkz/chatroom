'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type OnlineUser = {
  id: string
  nickname: string
}

type Room = {
  id: string
  name: string
  description: string | null
}

type Props = {
  user: User
  selectedRoomId: string | null
  onSelectRoom: (room: Room) => void
}

export default function Feed({ user, selectedRoomId, onSelectRoom }: Props) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [newRoomName, setNewRoomName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const displayName =
    user.user_metadata?.nickname || user.email?.split('@')[0] || 'User'

  const supabase = createClient()

  // Load rooms
  useEffect(() => {
    const loadRooms = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: true })

      if (data) {
        setRooms(data)
        // Auto-select first room if none selected
        if (!selectedRoomId && data.length > 0) {
          onSelectRoom(data[0])
        }
      }
    }

    loadRooms()
  }, [])

  // Online users
  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: { key: user.id },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: OnlineUser[] = []

        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            users.push({
              id: presence.user_id,
              nickname: presence.nickname,
            })
          })
        })

        const uniqueUsers = Array.from(
          new Map(users.map((u) => [u.id, u])).values()
        )
        setOnlineUsers(uniqueUsers)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            nickname: displayName,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, displayName])

  const createRoom = async () => {
    const name = newRoomName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name) return

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    if (data) {
      setRooms((prev) => [...prev, data])
      onSelectRoom(data)
      setNewRoomName('')
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#2b2d31] text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1e1f22] font-semibold text-sm">
        Chat Room
      </div>

      {/* Rooms */}
      <div className="px-2 pt-4">
        <div className="flex items-center justify-between px-2 mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase">Rooms</p>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="text-gray-400 hover:text-white text-lg leading-none"
            title="Create Room"
          >
            +
          </button>
        </div>

        {isCreating && (
          <div className="px-2 mb-2 flex gap-1">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="room-name"
              className="flex-1 bg-[#1e1f22] text-sm rounded px-2 py-1 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && createRoom()}
            />
            <button
              onClick={createRoom}
              className="text-xs bg-indigo-600 px-2 py-1 rounded hover:bg-indigo-500"
            >
              Add
            </button>
          </div>
        )}

        <div className="space-y-0.5">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition ${
                selectedRoomId === room.id
                  ? 'bg-[#404249] text-white'
                  : 'text-gray-400 hover:bg-[#35373c] hover:text-gray-200'
              }`}
            >
              <span className="text-gray-500">#</span>
              {room.name}
            </button>
          ))}
        </div>
      </div>

      {/* Online Members */}
      <div className="mt-6 px-2 flex-1 overflow-y-auto">
        <p className="px-2 text-xs font-semibold text-gray-400 uppercase mb-2">
          Online — {onlineUsers.length}
        </p>

        <div className="space-y-1">
          {onlineUsers.map((onlineUser) => (
            <div
              key={onlineUser.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#35373c]"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-medium text-white">
                  {onlineUser.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#2b2d31]" />
              </div>
              <span className="text-sm text-gray-200">
                {onlineUser.nickname}
                {onlineUser.id === user.id && (
                  <span className="text-gray-500 text-xs ml-1">(you)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* User panel */}
      <div className="p-2 bg-[#232428] border-t border-[#1e1f22]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-medium text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#232428]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-gray-400">Online</p>
          </div>
        </div>
      </div>
    </div>
  )
}