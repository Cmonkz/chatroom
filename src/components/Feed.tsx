'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export default function Feed({ user }: { user: User }) {
  const displayName =
    user.user_metadata?.nickname || user.email?.split('@')[0] || 'User'

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  // Christmas countdown
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date()
      const currentYear = now.getFullYear()
      let christmas = new Date(currentYear, 11, 25) // Dec 25

      // If Christmas already passed this year, use next year
      if (now > christmas) {
        christmas = new Date(currentYear + 1, 11, 25)
      }

      const difference = christmas.getTime() - now.getTime()

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        })
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/christmas.jpg')`,
        }}
      >
        {/* Dark overlay so text is readable */}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full text-white">
        {/* Header */}
        <div className="p-4 border-b border-white/20 backdrop-blur-sm">
          <h2 className="text-lg font-semibold">Feed</h2>
          <p className="text-sm text-white/80">Welcome, {displayName}</p>
        </div>

        {/* Christmas Countdown */}
        <div className="p-5">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center shadow-lg">
            <div className="text-3xl mb-2">🎄</div>
            <h3 className="text-lg font-semibold mb-1">Christmas Countdown</h3>
            <p className="text-sm text-white/70 mb-4">Until December 25</p>

            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white/10 rounded-xl py-3">
                <div className="text-2xl font-bold">{timeLeft.days}</div>
                <div className="text-xs text-white/70 mt-1">Days</div>
              </div>
              <div className="bg-white/10 rounded-xl py-3">
                <div className="text-2xl font-bold">{timeLeft.hours}</div>
                <div className="text-xs text-white/70 mt-1">Hours</div>
              </div>
              <div className="bg-white/10 rounded-xl py-3">
                <div className="text-2xl font-bold">{timeLeft.minutes}</div>
                <div className="text-xs text-white/70 mt-1">Mins</div>
              </div>
              <div className="bg-white/10 rounded-xl py-3">
                <div className="text-2xl font-bold">{timeLeft.seconds}</div>
                <div className="text-xs text-white/70 mt-1">Secs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feed items */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
            <p className="font-medium text-sm">System</p>
            <p className="text-sm text-white/80 mt-1">
              Welcome to the room! 🎄 The Christmas countdown is live.
            </p>
            <p className="text-xs text-white/50 mt-2">Just now</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
            <p className="font-medium text-sm">Announcement</p>
            <p className="text-sm text-white/80 mt-1">
              You can later put music, posts, or room activity here.
            </p>
            <p className="text-xs text-white/50 mt-2">2 min ago</p>
          </div>
        </div>
      </div>
    </div>
  )
}