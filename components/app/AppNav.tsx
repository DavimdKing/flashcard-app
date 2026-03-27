// components/app/AppNav.tsx
export interface NavItem {
  label: string
  href: string
  icon: string
  mobileLabel: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠', mobileLabel: 'Home' },
  { label: 'Play Game',  href: '/play',      icon: '🎮', mobileLabel: 'Play' },
  { label: 'Practice',  href: '/practice',  icon: '📚', mobileLabel: 'Practice' },
  { label: 'Settings',  href: '/settings',  icon: '⚙️', mobileLabel: 'Settings' },
]

export function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}
