import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatRoom from '@/components/Chatroom';

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If not logged in → go to login page
  if (!user) {
    redirect('/login')
  }

  return <ChatRoom user={user} />
}
