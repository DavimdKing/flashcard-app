import { render, screen } from '@testing-library/react'
import PracticeGroupGrid from './PracticeGroupGrid'
import type { PracticeGroupSummary } from '@/lib/types'

const groups: PracticeGroupSummary[] = [
  { id: 'g1', name: 'Food & Drinks', icon: '🍎', word_count: 20, best_score: 85 },
  { id: 'g2', name: 'City Life', icon: '🏙️', word_count: 20, best_score: null },
]

describe('PracticeGroupGrid', () => {
  it('renders group names', () => {
    render(<PracticeGroupGrid groups={groups} onToggle={() => {}} onPreview={() => {}} />)
    expect(screen.getByText('Food & Drinks')).toBeInTheDocument()
    expect(screen.getByText('City Life')).toBeInTheDocument()
  })

  it('renders links to each group', () => {
    render(<PracticeGroupGrid groups={groups} onToggle={() => {}} onPreview={() => {}} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/practice/g1')).toBe(true)
    expect(links.some(l => l.getAttribute('href') === '/practice/g2')).toBe(true)
  })
})
