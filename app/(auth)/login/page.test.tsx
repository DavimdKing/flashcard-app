import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from './page'

const mockSignInWithOAuth = jest.fn()

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithOAuth: mockSignInWithOAuth }
  })
}))

describe('LoginPage', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
  })

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

  it('shows error message when OAuth fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'OAuth error' } })
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('OAuth error')
  })
})
