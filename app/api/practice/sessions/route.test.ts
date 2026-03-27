/**
 * @jest-environment node
 */
import { POST } from './route'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockServiceFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockServiceFrom }),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/practice/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/practice/sessions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ group_id: 'abc', score_pct: 80 }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { is_approved: false } }) }) }),
    })
    const res = await POST(makeRequest({ group_id: 'abc', score_pct: 80 }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid score_pct', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { is_approved: true } }) }) }),
    })
    const res = await POST(makeRequest({ group_id: 'a'.repeat(36), score_pct: 150 }))
    expect(res.status).toBe(400)
  })
})
