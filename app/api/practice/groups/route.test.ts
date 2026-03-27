/**
 * @jest-environment node
 */
import { GET } from './route'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockServiceFrom = jest.fn()
const mockServiceRpc = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockServiceFrom, rpc: mockServiceRpc }),
}))

describe('GET /api/practice/groups', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(new Request('http://localhost/api/practice/groups'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { is_approved: false } }) }) }),
    })
    const res = await GET(new Request('http://localhost/api/practice/groups'))
    expect(res.status).toBe(403)
  })
})
