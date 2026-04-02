import { render, screen, fireEvent, act } from '@testing-library/react'
import MultipleChoiceStack from './MultipleChoiceStack'
import type { MultipleChoiceWord } from '@/lib/types'

const makeWord = (word_id: string, thai: string, choices: string[]): MultipleChoiceWord => ({
  word_id,
  english_word: 'word',
  thai_translation: thai,
  part_of_speech: null,
  image_url: null,
  audio_url: null,
  english_example: null,
  thai_example: null,
  choices,
})

const word1 = makeWord('w1', 'หนึ่ง', ['หนึ่ง', 'สอง', 'สาม', 'สี่'])
const word2 = makeWord('w2', 'สอง', ['สอง', 'หนึ่ง', 'สาม', 'สี่'])
const words = [word1, word2]

// Helper: submit the current card
const submitCard = (choiceText: string) => {
  fireEvent.click(screen.getByText(choiceText))
  fireEvent.click(screen.getByRole('button', { name: /submit/i }))
}

// Helper: swipe left to advance (simulates swipe from back face)
const swipeLeft = () => {
  const container = screen.getByTestId('mc-card-container')
  fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
  fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 300 }] })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  global.fetch = jest.fn(() => Promise.resolve({ ok: true })) as jest.Mock
})
afterEach(() => jest.useRealTimers())

describe('MultipleChoiceStack — progress', () => {
  it('shows 0/N progress at start', () => {
    render(<MultipleChoiceStack words={words} mode="practice" onSessionComplete={jest.fn()} />)
    expect(screen.getByText('0/2')).toBeInTheDocument()
  })

  it('advances progress counter after swipe left', async () => {
    render(<MultipleChoiceStack words={words} mode="practice" onSessionComplete={jest.fn()} />)
    submitCard('หนึ่ง')
    await act(async () => { jest.advanceTimersByTime(501) })
    await act(async () => { swipeLeft() })
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
})

describe('MultipleChoiceStack — practice mode scoring', () => {
  it('calls onSessionComplete with correct score_pct', async () => {
    const onSessionComplete = jest.fn()
    render(<MultipleChoiceStack words={words} mode="practice" onSessionComplete={onSessionComplete} />)

    // Card 1: correct (หนึ่ง is the correct answer for word1)
    submitCard('หนึ่ง')
    await act(async () => { jest.advanceTimersByTime(501) })
    await act(async () => { swipeLeft() })

    // Card 2: wrong
    submitCard('หนึ่ง')  // wrong for word2 (correct is สอง)
    await act(async () => { jest.advanceTimersByTime(501) })
    await act(async () => { swipeLeft() })

    // 1 correct / 2 total = 50%
    expect(onSessionComplete).toHaveBeenCalledWith(50)
  })

  it('fires mistake-words POST on wrong answer in practice mode', async () => {
    render(<MultipleChoiceStack words={words} mode="practice" onSessionComplete={jest.fn()} />)
    submitCard('สอง')  // wrong for word1
    expect(fetch).toHaveBeenCalledWith('/api/mistake-words', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ word_id: 'w1' }),
    }))
  })

  it('does not fire mistake-words POST on correct answer in practice mode', async () => {
    render(<MultipleChoiceStack words={words} mode="practice" onSessionComplete={jest.fn()} />)
    submitCard('หนึ่ง')  // correct for word1
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('MultipleChoiceStack — retake mode', () => {
  it('calls onRetakeComplete with gotIt and nope word arrays', async () => {
    const onRetakeComplete = jest.fn()
    render(<MultipleChoiceStack words={words} mode="retake" onRetakeComplete={onRetakeComplete} />)

    // Card 1: correct
    submitCard('หนึ่ง')
    await act(async () => { jest.advanceTimersByTime(501) })
    await act(async () => { swipeLeft() })

    // Card 2: wrong
    submitCard('หนึ่ง')  // wrong for word2
    await act(async () => { jest.advanceTimersByTime(501) })
    await act(async () => { swipeLeft() })

    expect(onRetakeComplete).toHaveBeenCalledWith(['w1'], ['w2'])
  })

  it('fires DELETE on correct answer in retake mode', async () => {
    render(<MultipleChoiceStack words={words} mode="retake" onRetakeComplete={jest.fn()} />)
    submitCard('หนึ่ง')  // correct for word1
    expect(fetch).toHaveBeenCalledWith('/api/mistake-words/w1', { method: 'DELETE' })
  })

  it('does not fire DELETE on wrong answer in retake mode', async () => {
    render(<MultipleChoiceStack words={words} mode="retake" onRetakeComplete={jest.fn()} />)
    submitCard('สอง')  // wrong for word1
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('MultipleChoiceStack — completedRef prevents double-firing', () => {
  it('onSessionComplete called exactly once even if effect fires twice', async () => {
    const onSessionComplete = jest.fn()
    const { rerender } = render(
      <MultipleChoiceStack words={[word1]} mode="practice" onSessionComplete={onSessionComplete} />
    )
    submitCard('หนึ่ง')
    await act(async () => { jest.advanceTimersByTime(501) })
    await act(async () => { swipeLeft() })
    rerender(<MultipleChoiceStack words={[word1]} mode="practice" onSessionComplete={onSessionComplete} />)
    expect(onSessionComplete).toHaveBeenCalledTimes(1)
  })
})
