'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface UserInfo {
  displayName: string
  email: string
  avatarUrl: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setUser({
        displayName: user.user_metadata?.full_name ?? user.email ?? 'User',
        email: user.email ?? '',
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      })
    })
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initial = user?.displayName?.[0]?.toUpperCase() ?? '?'

  return (
    <main className="p-4 md:p-8 max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-6">
          {user?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-2xl font-bold">
              {initial}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800 text-lg">{user?.displayName ?? '—'}</p>
            <p className="text-sm text-gray-500">{user?.email ?? '—'}</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm py-2 border-b border-gray-50">
            <span className="text-gray-500">Display name</span>
            <span className="text-gray-800 font-medium">{user?.displayName ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm py-2 border-b border-gray-50">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-800 font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm py-2">
            <span className="text-gray-500">Login method</span>
            <span className="text-gray-800 font-medium">Google</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
