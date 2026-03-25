import { createClient } from '@/lib/supabase/server'
import UserMenu from '@/components/ui/UserMenu'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50">
      <header className="flex justify-end p-4">
        <UserMenu email={email} />
      </header>
      {children}
    </div>
  )
}
