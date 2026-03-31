'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserMenu from '@/components/ui/UserMenu'

const navLinks = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/words', label: 'Word Database', icon: '📚' },
  { href: '/admin/daily-set', label: "Today's Set", icon: '📅' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/practice-groups', label: 'Practice Groups', icon: '🗂️' },
]

interface Props {
  noImageCount: number
  email: string
}

export default function AdminSidebar({ noImageCount, email }: Props) {
  const [collapsed, setCollapsed] = useState(true)
  const pathname = usePathname()

  const collapse = () => setCollapsed(true)

  return (
    <aside
      className="bg-white shadow-md flex flex-col p-4 gap-2 min-h-screen overflow-hidden transition-[width] duration-200 md:w-56"
      style={{ width: collapsed ? '3rem' : '14rem' }}
    >
      {/* Header / toggle */}
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <button
          className="md:hidden text-purple-600 text-xl leading-none flex-shrink-0"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? '☰' : '✕'}
        </button>
        <h1 className={`text-lg font-bold text-purple-600 whitespace-nowrap overflow-hidden ${collapsed ? 'hidden' : 'block'} md:block`}>
          🌸 Admin
        </h1>
      </div>

      {/* Main nav links */}
      {navLinks.map(link => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={collapse}
            className={`flex items-center gap-2 px-2 py-2 rounded-xl text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition text-sm font-medium ${active ? 'bg-purple-50 text-purple-600' : ''}`}
          >
            <span className="text-base leading-none flex-shrink-0">{link.icon}</span>
            <span className={`whitespace-nowrap overflow-hidden ${collapsed ? 'hidden' : 'block'} md:block`}>
              {link.label}
            </span>
          </Link>
        )
      })}

      {/* No Image link with badge */}
      <Link
        href="/admin/words/no-image"
        onClick={collapse}
        className="flex items-center gap-2 px-2 py-2 rounded-xl text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition text-sm font-medium"
      >
        <span className="text-base leading-none flex-shrink-0">🖼️</span>
        <span className={`flex items-center justify-between flex-1 whitespace-nowrap overflow-hidden ${collapsed ? 'hidden' : 'flex'} md:flex`}>
          <span>No Image</span>
          {noImageCount > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {noImageCount}
            </span>
          )}
        </span>
      </Link>

      {/* User menu — hidden when collapsed on mobile */}
      <div className={`mt-auto ${collapsed ? 'hidden' : 'block'} md:block`}>
        <UserMenu email={email} />
      </div>
    </aside>
  )
}
