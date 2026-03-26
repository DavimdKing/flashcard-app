'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './AppNav'

export default function AppBottomBar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-purple-600 flex justify-around py-2 z-40">
      {NAV_ITEMS.map(item => {
        const active = isActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-4 ${
              active ? 'text-white' : 'text-white/55'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.mobileLabel}</span>
          </Link>
        )
      })}
    </nav>
  )
}
