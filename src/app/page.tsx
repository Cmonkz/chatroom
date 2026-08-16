import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/Chatroom'
import Feed from '@/components/Feed'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left side - Feed */}
      <div className="w-full md:w-5/12 lg:w-8/12 border-r bg-white overflow-y-auto">
        <Feed user={user} />
      </div>

      {/* Right side - Chat */}
      <div className="flex-1 flex justify-center items-end p-4 bg-gray-100">
        <div className="w-full max-w-md h-[85vh] shadow-xl rounded-2xl overflow-hidden">
          <ChatRoom user={user} />
        </div>
      </div>
    </div>
  )
}