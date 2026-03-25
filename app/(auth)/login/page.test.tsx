import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from './page'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithOAuth: jest.fn() }
  })
}))

describe('LoginPage', () => {
  it('renders Google login button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('renders Facebook login button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /continue with facebook/i })).toBeInTheDocument()
  })

  it('renders no email or password inputs', () => {
    render(<LoginPage />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
