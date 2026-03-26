// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppSidebar from '@/components/app/AppSidebar'
import AppBottomBar from '@/components/app/AppBottomBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName: string = user.user_metadata?.full_name ?? user.email ?? 'User'
  const avatarUrl: string | null = user.user_metadata?.avatar_url ?? null

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50">
      <AppSidebar displayName={displayName} avatarUrl={avatarUrl} />
      {/* Offset content by sidebar width on desktop; add bottom padding on mobile for tab bar */}
      <div className="md:ml-[110px] pb-16 md:pb-0">
        {children}
      </div>
      <AppBottomBar />
    </div>
  )
}
