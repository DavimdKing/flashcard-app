import { createServiceClient } from '../lib/supabase/service'

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL
  if (!email) throw new Error('ADMIN_SEED_EMAIL env var is not set')

  const service = createServiceClient()
  const { data, error } = await service
    .from('users')
    .update({ is_admin: true, is_approved: true })
    .eq('email', email)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    console.error('No user found with email:', email, '— log in first, then re-run this script.')
    process.exit(1)
  }

  console.log('Admin promoted:', data[0])
}

main().catch(err => { console.error(err); process.exit(1) })
