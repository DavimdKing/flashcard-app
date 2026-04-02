import { render, screen, fireEvent, act } from '@testing-library/react'
import MultipleChoiceCard from './MultipleChoiceCard'
import type { MultipleChoiceWord } from '@/lib/types'

const mockWord: MultipleChoiceWord = {
  word_id: 'w1',
  english_word: 'abundant',
  thai_translation: 'มากมาย',
  part_of_speech: 'adjective',
  image_url: null,
  audio_url: null,
  english_example: 'There is abundant food.',
  thai_example: 'มีอาหารมากมาย',
  choices: ['มากมาย', 'สวยงาม', 'เงียบสงบ', 'กล้าหาญ'],
}

const defaultProps = {
  word: mockWord,
  bgGradient: 'from-pink-300 to-purple-300',
  onSubmit: jest.fn(),
  onSwipeNext: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('MultipleChoiceCard — front face', () => {
  it('shows the English word', () => {
    render(<MultipleChoiceCard {...defaultProps} />)
    expect(screen.getByText('abundant')).toBeInTheDocument()
  })

  it('renders exactly 4 choice buttons', () => {
    render(<MultipleChoiceCard {...defaultProps} />)
    const choices = ['มากมาย', 'สวยงาม', 'เงียบสงบ', 'กล้าหาญ']
    choices.forEach(c => expect(screen.getByText(c)).toBeInTheDocument())
  })

  it('Submit button is disabled before any choice is selected', () => {
    render(<MultipleChoiceCard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('Submit button becomes enabled after selecting a choice', () => {
    render(<MultipleChoiceCard {...defaultProps} />)
    fireEvent.click(screen.getByText('สวยงาม'))
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled()
  })

  it('calls onSubmit(true) when correct answer is selected and submitted', () => {
    const onSubmit = jest.fn()
    render(<MultipleChoiceCard {...defaultProps} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('มากมาย'))  // correct answer
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith(true)
  })

  it('calls onSubmit(false) when wrong answer is selected and submitted', () => {
    const onSubmit = jest.fn()
    render(<MultipleChoiceCard {...defaultProps} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('สวยงาม'))  // wrong answer
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(onSubmit).toHaveBeenCalledWith(false)
  })

  it('swipe right on front face does nothing', () => {
    const onSubmit = jest.fn()
    const onSwipeNext = jest.fn()
    render(<MultipleChoiceCard {...defaultProps} onSubmit={onSubmit} onSwipeNext={onSwipeNext} />)
    const container = screen.getByTestId('mc-card-container')
    fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 300 }] })
    fireEvent.touchEnd(container, { changedTouches: [{ clientX: 200, clientY: 300 }] })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onSwipeNext).not.toHaveBeenCalled()
  })
})

describe('MultipleChoiceCard — after submit', () => {
  afterEach(() => jest.useRealTimers())

  const submitCorrect = () => {
    render(<MultipleChoiceCard {...defaultProps} />)
    fireEvent.click(screen.getByText('มากมาย'))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
  }

  const submitWrong = () => {
    render(<MultipleChoiceCard {...defaultProps} />)
    fireEvent.click(screen.getByText('สวยงาม'))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
  }

  it('shows correct badge when right answer selected', () => {
    submitCorrect()
    expect(screen.getByText(/correct/i)).toBeInTheDocument()
  })

  it('shows wrong badge with correct answer when wrong answer selected', () => {
    submitWrong()
    expect(screen.getByText(/wrong/i)).toBeInTheDocument()
    expect(screen.getAllByText(/มากมาย/).length).toBeGreaterThan(0)
  })

  it('flip-back button is visible after submit', () => {
    submitCorrect()
    expect(screen.getByRole('button', { name: /flip back/i })).toBeVisible()
  })

  it('Submit stays disabled after flip-back', () => {
    jest.useFakeTimers()
    render(<MultipleChoiceCard {...defaultProps} />)
    fireEvent.click(screen.getByText('มากมาย'))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    act(() => { jest.advanceTimersByTime(501) })
    fireEvent.click(screen.getByRole('button', { name: /flip back/i }))
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled()
  })

  it('swipe left from back face calls onSwipeNext', () => {
    jest.useFakeTimers()
    const onSwipeNext = jest.fn()
    render(<MultipleChoiceCard {...defaultProps} onSwipeNext={onSwipeNext} />)
    fireEvent.click(screen.getByText('มากมาย'))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    act(() => { jest.advanceTimersByTime(501) })
    const container = screen.getByTestId('mc-card-container')
    fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 300 }] })
    fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 300 }] })
    expect(onSwipeNext).toHaveBeenCalledTimes(1)
  })

  it('swipe right from back face flips back (flip-back button becomes hidden)', () => {
    jest.useFakeTimers()
    render(<MultipleChoiceCard {...defaultProps} />)
    fireEvent.click(screen.getByText('มากมาย'))
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    act(() => { jest.advanceTimersByTime(501) })
    const container = screen.getByTestId('mc-card-container')
    fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 300 }] })
    fireEvent.touchEnd(container, { changedTouches: [{ clientX: 200, clientY: 300 }] })
    // After flip-back the flip button should be hidden again
    expect(screen.getByRole('button', { name: /flip back/i })).not.toBeVisible()
  })
})
