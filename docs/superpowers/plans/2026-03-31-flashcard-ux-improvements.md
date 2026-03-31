# Flashcard UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flip-back button, swipe/drag gestures, and a mobile-collapsible admin sidebar to the flashcard app.

**Architecture:** Tasks 1 and 2 both touch `FlashCard.tsx` and `CardStack.tsx` and must run in order — Task 1 adds the flip-back prop that Task 2 reuses. Task 3 is fully independent (admin sidebar only) and can run in any order relative to Tasks 1–2. Each task ends with a commit and passing tests.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Jest + @testing-library/react (jsdom)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `components/game/FlashCard.tsx` | Modify | Add `onFlipBack` + `onSwipeGotIt` props, flip-back button UI, touch/mouse swipe handlers |
| `components/game/CardStack.tsx` | Modify | Pass new FlashCard props, fix timer cancellation in `handleGrade` |
| `components/game/FlashCard.test.tsx` | Modify | Update existing renders, add flip-back and swipe tests |
| `components/admin/AdminSidebar.tsx` | Create | Client component with collapsed state and hamburger toggle |
| `components/admin/AdminSidebar.test.tsx` | Create | Tests for toggle and auto-collapse |
| `app/admin/layout.tsx` | Modify | Replace inline sidebar with `<AdminSidebar />` |

---

## Task 1: Flip-Back Button

**Files:**
- Modify: `components/game/FlashCard.tsx`
- Modify: `components/game/CardStack.tsx`
- Modify: `components/game/FlashCard.test.tsx`

- [ ] **Step 1.1: Write failing tests for flip-back button**

  Replace the entire content of `components/game/FlashCard.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from '@testing-library/react'
  import FlashCard from './FlashCard'

  const mockWord = {
    word_id: 'w1',
    position: 1,
    english_word: 'Elephant',
    thai_translation: 'ช้าง',
    image_url: '/elephant.jpg',
    audio_url: null,
    part_of_speech: null,
    english_example: null,
    thai_example: null,
  }

  // Default props — update all tests to use spread so new required props are always present
  const defaultProps = {
    word: mockWord,
    onFlipped: jest.fn(),
    onFlipBack: jest.fn(),
    onSwipeGotIt: jest.fn(),
    bgGradient: 'from-pink-200 to-purple-200',
  }

  beforeEach(() => jest.clearAllMocks())

  describe('FlashCard — existing behaviour', () => {
    it('shows English word on front face', () => {
      render(<FlashCard {...defaultProps} />)
      expect(screen.getByText('Elephant')).toBeInTheDocument()
    })

    it('does not show Thai translation before flip', () => {
      render(<FlashCard {...defaultProps} />)
      expect(screen.queryByText('ช้าง')).not.toBeVisible()
    })

    it('calls onFlipped when card body is clicked', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      fireEvent.click(screen.getByTestId('card-body'))
      expect(onFlipped).toHaveBeenCalledTimes(1)
    })

    it('renders SoundButton in top-left', () => {
      render(<FlashCard {...defaultProps} />)
      expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument()
    })

    it('does not call onFlipped on second click after flip', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      fireEvent.click(screen.getByTestId('card-body'))
      fireEvent.click(screen.getByTestId('card-body'))
      expect(onFlipped).toHaveBeenCalledTimes(1)
    })
  })

  describe('FlashCard — flip-back button', () => {
    it('flip-back button is not visible before card is flipped', () => {
      render(<FlashCard {...defaultProps} />)
      expect(screen.queryByRole('button', { name: /flip back/i })).not.toBeVisible()
    })

    it('flip-back button is visible after card is flipped', () => {
      render(<FlashCard {...defaultProps} />)
      fireEvent.click(screen.getByTestId('card-body'))
      expect(screen.getByRole('button', { name: /flip back/i })).toBeVisible()
    })

    it('calls onFlipBack when flip-back button is clicked', () => {
      const onFlipBack = jest.fn()
      render(<FlashCard {...defaultProps} onFlipBack={onFlipBack} />)
      fireEvent.click(screen.getByTestId('card-body'))
      fireEvent.click(screen.getByRole('button', { name: /flip back/i }))
      expect(onFlipBack).toHaveBeenCalledTimes(1)
    })
  })
  ```

- [ ] **Step 1.2: Run tests — verify they fail**

  ```bash
  npm test -- --testPathPattern=FlashCard --watchAll=false 2>&1 | tail -20
  ```

  Expected: compile error — `onFlipBack` and `onSwipeGotIt` are not valid props yet.

- [ ] **Step 1.3: Update `FlashCard.tsx` — add props, flip-back handler, and button**

  Replace the full file:

  ```tsx
  'use client'

  import { useState, useCallback, useRef } from 'react'
  import SoundButton from '@/components/ui/SoundButton'
  import type { DailySetResponse } from '@/lib/types'

  type WordData = DailySetResponse['words'][number]

  interface Props {
    word: WordData
    onFlipped: () => void
    onFlipBack: () => void
    onSwipeGotIt: () => void
    bgGradient: string
  }

  export default function FlashCard({ word, onFlipped, onFlipBack, onSwipeGotIt, bgGradient }: Props) {
    const [isFlipped, setIsFlipped] = useState(false)
    const [ignoreClicks, setIgnoreClicks] = useState(false)
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    const mouseStartRef = useRef<{ x: number; y: number } | null>(null)

    const handleCardClick = useCallback(() => {
      if (isFlipped || ignoreClicks) return
      setIsFlipped(true)
      setIgnoreClicks(true)
      onFlipped()
      setTimeout(() => setIgnoreClicks(false), 500)
    }, [isFlipped, ignoreClicks, onFlipped])

    const handleFlipBack = useCallback(() => {
      if (ignoreClicks) return
      setIsFlipped(false)
      setIgnoreClicks(true)
      onFlipBack()
      setTimeout(() => setIgnoreClicks(false), 500)
    }, [ignoreClicks, onFlipBack])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }, [])

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
      if (!touchStartRef.current || ignoreClicks) { touchStartRef.current = null; return }
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      touchStartRef.current = null
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
      if (dx < 0) {
        if (!isFlipped) handleCardClick()
        else onSwipeGotIt()
      } else if (isFlipped) {
        handleFlipBack()
      }
    }, [ignoreClicks, isFlipped, handleCardClick, onSwipeGotIt, handleFlipBack])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      mouseStartRef.current = { x: e.clientX, y: e.clientY }
    }, [])

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
      if (!mouseStartRef.current || ignoreClicks) { mouseStartRef.current = null; return }
      const dx = e.clientX - mouseStartRef.current.x
      const dy = e.clientY - mouseStartRef.current.y
      mouseStartRef.current = null
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
      if (dx < 0) {
        if (!isFlipped) handleCardClick()
        else onSwipeGotIt()
      } else if (isFlipped) {
        handleFlipBack()
      }
    }, [ignoreClicks, isFlipped, handleCardClick, onSwipeGotIt, handleFlipBack])

    const imgVisible = isFlipped ? '' : 'opacity-0 pointer-events-none'

    return (
      <div
        data-testid="card-container"
        className="relative w-full max-w-[420px] mx-auto"
        style={{ perspective: '1000px' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div
          className="relative w-full"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            aspectRatio: '3/4',
          }}
        >
          {/* Front face */}
          <div
            data-testid="card-body"
            onClick={handleCardClick}
            className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col p-5 cursor-pointer select-none shadow-xl`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="absolute top-4 left-4">
              <SoundButton audioUrl={word.audio_url} />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h2 className="text-4xl font-bold text-white drop-shadow text-center">
                {word.english_word}
              </h2>
            </div>
            <p className="text-center text-white/70 text-sm">Tap to reveal ✨</p>
          </div>

          {/* Back face */}
          <div
            className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center gap-3 p-6 shadow-xl`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', visibility: isFlipped ? 'visible' : 'hidden' }}
          >
            <div className="absolute top-4 left-4">
              <SoundButton audioUrl={word.audio_url} />
            </div>

            {/* Flip-back button — top-right of back face */}
            <button
              onClick={handleFlipBack}
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-2 py-1 rounded-full transition"
              aria-label="Flip back to question"
            >
              ↩ flip
            </button>

            {/* Thai word */}
            <h2 className="text-4xl font-bold text-white drop-shadow text-center">{word.thai_translation}</h2>

            {/* Part of speech */}
            {word.part_of_speech && (
              <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">{word.part_of_speech}</p>
            )}

            {/* Image or placeholder */}
            {word.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={word.image_url}
                alt={word.thai_translation}
                className={`w-80 h-80 object-contain rounded-2xl ${imgVisible}`}
              />
            ) : (
              <div className={`w-80 h-80 bg-white/10 rounded-2xl ${imgVisible}`} />
            )}

            {/* Example sentences */}
            {word.english_example && (
              <p className="text-sm text-gray-800 font-medium text-center px-2 leading-relaxed">{word.english_example}</p>
            )}
            {word.english_example && word.thai_example && (
              <div className="w-10 h-px bg-gray-400/50" />
            )}
            {word.thai_example && (
              <p className="text-sm text-gray-800 font-medium text-center px-2 leading-relaxed">{word.thai_example}</p>
            )}
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 1.4: Update `CardStack.tsx` — add `handleFlipBack`, fix timer cancel in `handleGrade`, pass new props**

  Add `handleFlipBack` after `handleFlipped`:

  ```typescript
  const handleFlipBack = useCallback(() => {
    if (gradeBarTimerRef.current) {
      clearTimeout(gradeBarTimerRef.current)
      gradeBarTimerRef.current = null
    }
    setShowGradeBar(false)
  }, [])
  ```

  In `handleGrade`, add timer cancellation at the top (after the `saving` guard):

  ```typescript
  const handleGrade = async (result: GradeResult) => {
    if (saving || !currentWord) return
    // Cancel pending grade bar timer — prevents it firing on the next card
    if (gradeBarTimerRef.current) {
      clearTimeout(gradeBarTimerRef.current)
      gradeBarTimerRef.current = null
    }
    // ... rest of function unchanged
  ```

  Update the `<FlashCard>` JSX:

  ```tsx
  <FlashCard
    key={currentWord.word_id}
    word={currentWord}
    onFlipped={handleFlipped}
    onFlipBack={handleFlipBack}
    onSwipeGotIt={() => handleGrade('got_it')}
    bgGradient={GRADIENTS[currentIdx % GRADIENTS.length]}
  />
  ```

- [ ] **Step 1.5: Run tests — verify they pass**

  ```bash
  npm test -- --testPathPattern=FlashCard --watchAll=false 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 1.6: Commit**

  ```bash
  git add components/game/FlashCard.tsx components/game/CardStack.tsx components/game/FlashCard.test.tsx
  git commit -m "feat: add flip-back button to flashcard answer face"
  ```

---

## Task 2: Swipe Gestures

The swipe handler code was already included in `FlashCard.tsx` in Task 1 (the full file replacement in Step 1.3 includes all swipe logic). This task only adds the missing tests.

**Files:**
- Modify: `components/game/FlashCard.test.tsx`

- [ ] **Step 2.1: Add swipe tests to `FlashCard.test.tsx`**

  Append this describe block at the end of `FlashCard.test.tsx`:

  ```tsx
  describe('FlashCard — swipe gestures', () => {
    it('swipe left on front face calls onFlipped (flips to answer)', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      const container = screen.getByTestId('card-container')
      fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 300 }] })
      expect(onFlipped).toHaveBeenCalledTimes(1)
    })

    it('swipe right on front face does nothing', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      const container = screen.getByTestId('card-container')
      fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 300 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 200, clientY: 300 }] })
      expect(onFlipped).not.toHaveBeenCalled()
    })

    it('swipe less than 50px does nothing', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      const container = screen.getByTestId('card-container')
      fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 160, clientY: 300 }] })
      expect(onFlipped).not.toHaveBeenCalled()
    })

    it('mostly-vertical swipe does nothing', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      const container = screen.getByTestId('card-container')
      fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 130, clientY: 200 }] }) // dx=-70, dy=-100
      expect(onFlipped).not.toHaveBeenCalled()
    })

    it('swipe left on answer face calls onSwipeGotIt', () => {
      jest.useFakeTimers()
      const onSwipeGotIt = jest.fn()
      render(<FlashCard {...defaultProps} onSwipeGotIt={onSwipeGotIt} />)
      const container = screen.getByTestId('card-container')
      // Flip to answer first
      fireEvent.click(screen.getByTestId('card-body'))
      // Advance past ignoreClicks debounce
      jest.advanceTimersByTime(500)
      // Swipe left
      fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 300 }] })
      expect(onSwipeGotIt).toHaveBeenCalledTimes(1)
      jest.useRealTimers()
    })

    it('swipe right on answer face calls onFlipBack', () => {
      jest.useFakeTimers()
      const onFlipBack = jest.fn()
      render(<FlashCard {...defaultProps} onFlipBack={onFlipBack} />)
      const container = screen.getByTestId('card-container')
      // Flip to answer first
      fireEvent.click(screen.getByTestId('card-body'))
      jest.advanceTimersByTime(500)
      // Swipe right
      fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 300 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 200, clientY: 300 }] })
      expect(onFlipBack).toHaveBeenCalledTimes(1)
      jest.useRealTimers()
    })

    it('mouse drag left on front face calls onFlipped', () => {
      const onFlipped = jest.fn()
      render(<FlashCard {...defaultProps} onFlipped={onFlipped} />)
      const container = screen.getByTestId('card-container')
      fireEvent.mouseDown(container, { clientX: 200, clientY: 300 })
      fireEvent.mouseUp(container, { clientX: 100, clientY: 300 })
      expect(onFlipped).toHaveBeenCalledTimes(1)
    })
  })
  ```

- [ ] **Step 2.2: Run tests — verify they pass**

  ```bash
  npm test -- --testPathPattern=FlashCard --watchAll=false 2>&1 | tail -30
  ```

  Expected: all tests pass (the implementation is already in place from Task 1).

- [ ] **Step 2.3: Commit**

  ```bash
  git add components/game/FlashCard.test.tsx
  git commit -m "test: add swipe gesture tests for FlashCard"
  ```

---

## Task 3: Admin Nav Mobile Collapse

**Files:**
- Create: `components/admin/AdminSidebar.tsx`
- Create: `components/admin/AdminSidebar.test.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 3.1: Write failing tests for AdminSidebar**

  Create `components/admin/AdminSidebar.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from '@testing-library/react'
  import AdminSidebar from './AdminSidebar'

  jest.mock('next/navigation', () => ({
    usePathname: () => '/admin',
  }))

  describe('AdminSidebar', () => {
    it('renders all nav links', () => {
      render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Word Database')).toBeInTheDocument()
      expect(screen.getByText("Today's Set")).toBeInTheDocument()
      expect(screen.getByText('Users')).toBeInTheDocument()
      expect(screen.getByText('Practice Groups')).toBeInTheDocument()
      expect(screen.getByText('No Image')).toBeInTheDocument()
    })

    it('shows noImageCount badge when count > 0', () => {
      render(<AdminSidebar noImageCount={5} email="admin@test.com" />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('does not show badge when noImageCount is 0', () => {
      render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('toggle button expands sidebar', () => {
      render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
      const toggle = screen.getByRole('button', { name: /expand navigation/i })
      fireEvent.click(toggle)
      expect(screen.getByRole('button', { name: /collapse navigation/i })).toBeInTheDocument()
    })

    it('clicking a nav link collapses the sidebar', () => {
      render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
      // Expand first
      fireEvent.click(screen.getByRole('button', { name: /expand navigation/i }))
      // Click a nav link
      fireEvent.click(screen.getByRole('link', { name: /word database/i }))
      // Toggle should be back to expand
      expect(screen.getByRole('button', { name: /expand navigation/i })).toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 3.2: Run tests — verify they fail**

  ```bash
  npm test -- --testPathPattern=AdminSidebar --watchAll=false 2>&1 | tail -10
  ```

  Expected: FAIL — `AdminSidebar` module not found.

- [ ] **Step 3.3: Create `components/admin/AdminSidebar.tsx`**

  ```tsx
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
  ```

- [ ] **Step 3.4: Run tests — verify they pass**

  ```bash
  npm test -- --testPathPattern=AdminSidebar --watchAll=false 2>&1 | tail -20
  ```

  Expected: all 5 tests pass.

- [ ] **Step 3.5: Update `app/admin/layout.tsx` — replace inline sidebar with `<AdminSidebar />`**

  Replace the full file:

  ```tsx
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
  ```

- [ ] **Step 3.6: Run full test suite to confirm nothing is broken**

  ```bash
  npm test -- --watchAll=false 2>&1 | tail -20
  ```

  Expected: all tests pass.

- [ ] **Step 3.7: Commit**

  ```bash
  git add components/admin/AdminSidebar.tsx components/admin/AdminSidebar.test.tsx app/admin/layout.tsx
  git commit -m "feat: collapsible admin sidebar on mobile with hamburger toggle"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Flip-back button on answer face (Task 1)
- ✅ Swipe left on front = flip to answer (Task 2)
- ✅ Swipe left on answer = Got it + next (Task 2)
- ✅ Swipe right on answer = flip back (Task 2)
- ✅ Mouse drag support (Task 2)
- ✅ 50px threshold + directionality check (Task 2)
- ✅ Grade bar hides on flip-back (CardStack `handleFlipBack` clears timer + sets `showGradeBar(false)`)
- ✅ Swipe works in all 3 modes (daily/practice/retake) — `onSwipeGotIt` delegates to `handleGrade('got_it')` which already handles all modes
- ✅ Admin sidebar icon-only when collapsed (Task 3)
- ✅ Hamburger toggle, mobile only (Task 3)
- ✅ Auto-collapse on nav click (Task 3)
- ✅ Desktop always expanded (Task 3)
- ✅ Width animation (Task 3 — `transition-[width] duration-200`)

**Placeholder scan:** None found.

**Type consistency:**
- `onFlipBack: () => void` — defined in Props (Step 1.3), used in `handleFlipBack`, tested in Step 1.1 and 2.1
- `onSwipeGotIt: () => void` — defined in Props (Step 1.3), called in touch/mouse handlers, tested in Step 2.1
- `handleFlipBack` in CardStack — defined in Step 1.4, passed as `onFlipBack` to FlashCard ✅
- `AdminSidebar` props `noImageCount: number, email: string` — match layout.tsx call site ✅
