/**
 * @jest-environment node
 */

import { buildProgressResponse, validateProgressBody } from './route'

describe('buildProgressResponse', () => {
  it('calculates graded count correctly', () => {
    const results = [
      { word_id: 'w1', result: 'got_it' as const },
      { word_id: 'w2', result: 'nope' as const },
    ]
    const response = buildProgressResponse('set-1', results, 10)
    expect(response.graded).toBe(2)
    expect(response.total).toBe(10)
  })
})

describe('validateProgressBody', () => {
  it('rejects invalid result values', () => {
    expect(validateProgressBody({ set_id: 's', word_id: 'w', result: 'maybe' })).toBe(false)
  })
  it('accepts valid result values', () => {
    expect(validateProgressBody({ set_id: 's', word_id: 'w', result: 'got_it' })).toBe(true)
    expect(validateProgressBody({ set_id: 's', word_id: 'w', result: 'nope' })).toBe(true)
  })
  it('rejects missing fields', () => {
    expect(validateProgressBody({ set_id: 's', result: 'got_it' })).toBe(false)
  })
})
