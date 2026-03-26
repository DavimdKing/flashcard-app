'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './AppNav'

interface Props {
  displayName: string
  avatarUrl: string | null
}

export default function AppSidebar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname()
  const initial = displayName?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-[110px] bg-purple-600 flex-col gap-1 px-2 py-4 z-40">
      {/* Logo */}
      <div className="text-white font-bold text-sm px-2 mb-4">🃏 FlashCards</div>

      {/* Nav links */}
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium transition ${
            isActive(item.href, pathname)
              ? 'bg-white/25 text-white'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}

      {/* User avatar pinned to bottom */}
      <div className="mt-auto border-t border-white/20 pt-3 px-1">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-white text-xs font-bold">
              {initial}
            </div>
          )}
          <span className="text-white/80 text-xs truncate">{displayName}</span>
        </div>
      </div>
    </aside>
  )
}
