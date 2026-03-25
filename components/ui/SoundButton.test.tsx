import { render, screen, fireEvent } from '@testing-library/react'
import SoundButton from './SoundButton'

describe('SoundButton', () => {
  it('renders with correct aria-label', () => {
    render(<SoundButton audioUrl="http://example.com/audio.mp3" />)
    expect(screen.getByRole('button', { name: /play pronunciation/i })).toBeInTheDocument()
  })

  it('shows error indicator when audioUrl is null', () => {
    render(<SoundButton audioUrl={null} />)
    expect(screen.getByTitle(/audio unavailable/i)).toBeInTheDocument()
  })
})
