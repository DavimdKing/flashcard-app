import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_admin, email').eq('id', user.id).single()
  if (!appUser?.is_admin) redirect('/play')

  const service = createServiceClient()
  const { count: noImageCount } = await service
    .from('words')
    .select('*', { count: 'exact', head: true })
    .is('image_url', null)
    .eq('is_deleted', false)

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar
        noImageCount={noImageCount ?? 0}
        email={appUser.email ?? ''}
      />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
