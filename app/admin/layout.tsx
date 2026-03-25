import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UserMenu from '@/components/ui/UserMenu'

const navLinks = [
  { href: '/admin', label: '📊 Dashboard' },
  { href: '/admin/words', label: '📚 Word Database' },
  { href: '/admin/daily-set', label: '📅 Today\'s Set' },
  { href: '/admin/users', label: '👥 Users' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_admin, email').eq('id', user.id).single()
  if (!appUser?.is_admin) redirect('/play')

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white shadow-md flex flex-col p-4 gap-2 min-h-screen">
        <h1 className="text-lg font-bold text-purple-600 mb-4">🌸 Admin</h1>
        {navLinks.map(link => (
          <Link key={link.href} href={link.href}
            className="px-3 py-2 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition text-sm font-medium">
            {link.label}
          </Link>
        ))}
        <div className="mt-auto">
          <UserMenu email={appUser.email} />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
