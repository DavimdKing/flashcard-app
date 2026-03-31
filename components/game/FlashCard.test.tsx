import { render, screen, fireEvent, act } from '@testing-library/react'
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
    jest.useFakeTimers()
    const onFlipBack = jest.fn()
    render(<FlashCard {...defaultProps} onFlipBack={onFlipBack} />)
    fireEvent.click(screen.getByTestId('card-body'))
    act(() => { jest.advanceTimersByTime(500) })
    fireEvent.click(screen.getByRole('button', { name: /flip back/i }))
    expect(onFlipBack).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
