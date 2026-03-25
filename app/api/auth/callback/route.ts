import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Validate next to prevent open redirect — must be a relative path with no protocol
  const rawNext = searchParams.get('next') ?? '/play'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/play'

  if (!code) return NextResponse.redirect(`${origin}/login?error=no_code`)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { user } = data
  const email = user.email

  // Facebook accounts without a confirmed email are rejected
  if (!email) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=no_email`)
  }

  const provider = user.app_metadata.provider as string
  if (provider !== 'google' && provider !== 'facebook') {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=unsupported_provider`)
  }
  const oauthProvider = provider

  // Upsert user record (no-op if already exists)
  const service = createServiceClient()
  const { error: upsertError } = await service.from('users').upsert(
    { id: user.id, email, oauth_provider: oauthProvider },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  if (upsertError) {
    console.error('[auth/callback] Failed to upsert user:', upsertError.message)
    return NextResponse.redirect(`${origin}/login?error=db_error`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
