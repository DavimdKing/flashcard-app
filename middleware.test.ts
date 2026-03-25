/**
 * @jest-environment node
 */
// Tests the route-matching logic (not the full middleware execution)
import { isPublicRoute, isAdminRoute } from './middleware'

describe('route guards', () => {
  it('marks /login as public', () => {
    expect(isPublicRoute('/login')).toBe(true)
  })
  it('marks /api/auth/callback as public', () => {
    expect(isPublicRoute('/api/auth/callback')).toBe(true)
  })
  it('marks /play as not public', () => {
    expect(isPublicRoute('/play')).toBe(false)
  })
  it('marks /admin as admin route', () => {
    expect(isAdminRoute('/admin')).toBe(true)
  })
  it('marks /admin/words as admin route', () => {
    expect(isAdminRoute('/admin/words')).toBe(true)
  })
  it('marks /play as not admin route', () => {
    expect(isAdminRoute('/play')).toBe(false)
  })
})
