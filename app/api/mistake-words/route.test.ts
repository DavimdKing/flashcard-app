/** @jest-environment node */
import { GET, POST } from './route'

const mockGetUser = jest.fn()

const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

beforeEach(() => jest.clearAllMocks())

describe('GET /api/mistake-words', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: { is_approved: false } }),
        })),
      })),
    })
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

describe('POST /api/mistake-words', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ word_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid word_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValueOnce({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: { is_approved: true } }),
        })),
      })),
    })
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ word_id: 'not-a-uuid' }),
    }))
    expect(res.status).toBe(400)
  })
})
