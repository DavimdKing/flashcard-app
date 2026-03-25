import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/play'

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
  const oauthProvider = provider === 'google' ? 'google' : 'facebook'

  // Upsert user record (no-op if already exists)
  const service = createServiceClient()
  await service.from('users').upsert(
    { id: user.id, email, oauth_provider: oauthProvider },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  return NextResponse.redirect(`${origin}${next}`)
}
