import { render, screen } from '@testing-library/react'
import ScoreScreen from './ScoreScreen'
import type { DailySetResponse, ProgressResult } from '@/lib/types'

jest.mock('canvas-confetti', () => jest.fn())

const words: DailySetResponse['words'] = Array.from({ length: 10 }, (_, i) => ({
  word_id: `w${i}`,
  position: i + 1,
  english_word: `Word${i}`,
  thai_translation: `คำ${i}`,
  image_url: `/img${i}.jpg`,
  audio_url: null,
}))

describe('ScoreScreen', () => {
  it('shows correct score', () => {
    const results: ProgressResult[] = words.slice(0, 7).map(w => ({ word_id: w.word_id, result: 'got_it' }))
    render(<ScoreScreen words={words} results={results} onPlayAgain={() => {}} />)
    expect(screen.getByText(/7 \/ 10/)).toBeInTheDocument()
  })

  it('shows Play Again button', () => {
    render(<ScoreScreen words={words} results={[]} onPlayAgain={() => {}} />)
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
  })
})
