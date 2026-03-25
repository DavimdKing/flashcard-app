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

describe('FlashCard', () => {
  it('shows English word on front face', () => {
    render(<FlashCard word={mockWord} onFlipped={() => {}} bgGradient="from-pink-200 to-purple-200" />)
    expect(screen.getByText('Elephant')).toBeInTheDocument()
  })

  it('does not show Thai translation before flip', () => {
    render(<FlashCard word={mockWord} onFlipped={() => {}} bgGradient="from-pink-200 to-purple-200" />)
    expect(screen.queryByText('ช้าง')).not.toBeVisible()
  })

  it('calls onFlipped when card body is clicked', () => {
    const onFlipped = jest.fn()
    render(<FlashCard word={mockWord} onFlipped={onFlipped} bgGradient="from-pink-200 to-purple-200" />)
    fireEvent.click(screen.getByTestId('card-body'))
    expect(onFlipped).toHaveBeenCalledTimes(1)
  })

  it('renders SoundButton in top-left', () => {
    render(<FlashCard word={mockWord} onFlipped={() => {}} bgGradient="from-pink-200 to-purple-200" />)
    expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument()
  })

  it('does not call onFlipped on second click after flip', () => {
    const onFlipped = jest.fn()
    render(<FlashCard word={mockWord} onFlipped={onFlipped} bgGradient="from-pink-200 to-purple-200" />)
    fireEvent.click(screen.getByTestId('card-body'))
    fireEvent.click(screen.getByTestId('card-body'))
    expect(onFlipped).toHaveBeenCalledTimes(1)
  })
})
