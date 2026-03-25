import { render, screen, fireEvent } from '@testing-library/react'
import SelfGradeBar from './SelfGradeBar'

describe('SelfGradeBar', () => {
  it('renders Nope and Got it buttons', () => {
    render(<SelfGradeBar onGrade={() => {}} disabled={false} />)
    expect(screen.getByRole('button', { name: /nope/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
  })

  it('calls onGrade with got_it when Got it! clicked', () => {
    const onGrade = jest.fn()
    render(<SelfGradeBar onGrade={onGrade} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onGrade).toHaveBeenCalledWith('got_it')
  })

  it('calls onGrade with nope when Nope clicked', () => {
    const onGrade = jest.fn()
    render(<SelfGradeBar onGrade={onGrade} disabled={false} />)
    fireEvent.click(screen.getByRole('button', { name: /nope/i }))
    expect(onGrade).toHaveBeenCalledWith('nope')
  })

  it('does not call onGrade when disabled', () => {
    const onGrade = jest.fn()
    render(<SelfGradeBar onGrade={onGrade} disabled={true} />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onGrade).not.toHaveBeenCalled()
  })
})
