'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null)

  const signIn = async (provider: 'google' | 'facebook') => {
    setAuthError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) setAuthError(error.message)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-purple-50 p-6">
      <div className="bg-white rounded-3xl shadow-lg p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <h1 className="text-3xl font-bold text-purple-600 tracking-tight">🌸 English Flash</h1>
        <p className="text-gray-500 text-sm text-center">Sign in to start learning</p>

        {authError && (
          <p role="alert" className="text-red-500 text-sm text-center">{authError}</p>
        )}

        <button
          type="button"
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-2xl py-3 px-4 font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => signIn('facebook')}
          className="w-full flex items-center justify-center gap-3 bg-[#1877F2] rounded-2xl py-3 px-4 font-medium text-white hover:bg-[#166FE5] transition"
        >
          <FacebookIcon />
          Continue with Facebook
        </button>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}
