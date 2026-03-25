'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  email: string
}

export default function UserMenu({ email }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-full bg-purple-200 text-purple-700 font-bold flex items-center justify-center"
        aria-label="User menu"
      >
        {email[0]?.toUpperCase() ?? '?'}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-lg p-2 min-w-[160px] z-50">
          <p className="text-xs text-gray-400 px-3 py-1 truncate">{email}</p>
          <button
            type="button"
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
