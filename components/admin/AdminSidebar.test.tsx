import { render, screen, fireEvent } from '@testing-library/react'
import AdminSidebar from './AdminSidebar'

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ replace: jest.fn() }),
}))

describe('AdminSidebar', () => {
  it('renders all nav links', () => {
    render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Word Database')).toBeInTheDocument()
    expect(screen.getByText("Today's Set")).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Practice Groups')).toBeInTheDocument()
    expect(screen.getByText('No Image')).toBeInTheDocument()
  })

  it('shows noImageCount badge when count > 0', () => {
    render(<AdminSidebar noImageCount={5} email="admin@test.com" />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('does not show badge when noImageCount is 0', () => {
    render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('toggle button expands sidebar', () => {
    render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
    const toggle = screen.getByRole('button', { name: /expand navigation/i })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /collapse navigation/i })).toBeInTheDocument()
  })

  it('clicking a nav link collapses the sidebar', () => {
    render(<AdminSidebar noImageCount={0} email="admin@test.com" />)
    // Expand first
    fireEvent.click(screen.getByRole('button', { name: /expand navigation/i }))
    // Click a nav link
    fireEvent.click(screen.getByRole('link', { name: /word database/i }))
    // Toggle should be back to expand
    expect(screen.getByRole('button', { name: /expand navigation/i })).toBeInTheDocument()
  })
})
