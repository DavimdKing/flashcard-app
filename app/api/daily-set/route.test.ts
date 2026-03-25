/**
 * @jest-environment node
 */

import { buildDailySetResponse } from './route'

describe('buildDailySetResponse', () => {
  it('maps DB rows to response shape with correct position order', () => {
    const setId = 'set-1'
    const setDate = '2026-03-25'
    const rows = [
      { word_id: 'w2', position: 2, english_word: 'Cat', thai_translation: 'แมว', image_url: 'img2', audio_url: null },
      { word_id: 'w1', position: 1, english_word: 'Dog', thai_translation: 'สุนัข', image_url: 'img1', audio_url: 'audio1' },
    ]

    const result = buildDailySetResponse(setId, setDate, rows)

    expect(result.set_id).toBe('set-1')
    expect(result.words[0].position).toBe(1)
    expect(result.words[1].position).toBe(2)
    expect(result.words[0].english_word).toBe('Dog')
  })
})
