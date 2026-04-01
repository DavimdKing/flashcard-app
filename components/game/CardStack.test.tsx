import { render, screen, fireEvent, act } from '@testing-library/react'
import CardStack from './CardStack'

const word1 = {
  word_id: 'w1', position: 1, english_word: 'Hello', thai_translation: 'สวัสดี',
  image_url: null, audio_url: null, part_of_speech: null, english_example: null, thai_example: null,
}
const word2 = {
  word_id: 'w2', position: 2, english_word: 'World', thai_translation: 'โลก',
  image_url: null, audio_url: null, part_of_speech: null, english_example: null, thai_example: null,
}
const mockSet = { set_id: 'set1', words: [word1, word2] }

describe('CardStack — daily mode optimistic grade', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

  it('advances to next card immediately without waiting for API response', async () => {
    // fetch never resolves — simulates slow/no network
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock

    render(<CardStack initialSet={mockSet} initialProgress={[]} mode="daily" />)

    // Skip preloading (8-second timeout in CardStack)
    await act(async () => { jest.advanceTimersByTime(8001) })

    // First card visible
    expect(screen.getByText('Hello')).toBeInTheDocument()

    // Flip card to answer
    fireEvent.click(screen.getByTestId('card-body'))

    // Advance past ignoreClicks debounce (500ms) and grade bar timer (500ms)
    await act(async () => { jest.advanceTimersByTime(501) })

    // Swipe left on answer face → should trigger "Got it!" immediately
    const container = screen.getByTestId('card-container')
    fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
    fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 300 }] })

    // Card must advance to word2 even though fetch never resolved
    expect(screen.getByText('World')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('calls fetch with correct payload in daily mode', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as jest.Mock

    render(<CardStack initialSet={mockSet} initialProgress={[]} mode="daily" />)
    await act(async () => { jest.advanceTimersByTime(8001) })

    fireEvent.click(screen.getByTestId('card-body'))
    await act(async () => { jest.advanceTimersByTime(501) })

    const container = screen.getByTestId('card-container')
    fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
    fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 300 }] })

    expect(fetch).toHaveBeenCalledWith('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set_id: 'set1', word_id: 'w1', result: 'got_it' }),
    })
  })

  it('does not call fetch in practice mode', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock

    render(<CardStack initialSet={mockSet} initialProgress={[]} mode="practice" />)
    await act(async () => { jest.advanceTimersByTime(8001) })

    fireEvent.click(screen.getByTestId('card-body'))
    await act(async () => { jest.advanceTimersByTime(501) })

    // Click "Got it!" button (practice mode: no fetch for got_it, only nope)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))

    expect(fetch).not.toHaveBeenCalled()
  })
})
