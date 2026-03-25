import { toBangkokDateString, isSameDay } from '../bangkok-date'

describe('toBangkokDateString', () => {
  it('converts UTC midnight to correct Bangkok date string', () => {
    // UTC 2026-03-24 18:00 = Bangkok 2026-03-25 01:00
    const utcDate = new Date('2026-03-24T18:00:00Z')
    expect(toBangkokDateString(utcDate)).toBe('2026-03-25')
  })

  it('handles edge: UTC 16:59 is still Bangkok previous day', () => {
    // UTC 2026-03-24 16:59 = Bangkok 2026-03-24 23:59
    const utcDate = new Date('2026-03-24T16:59:00Z')
    expect(toBangkokDateString(utcDate)).toBe('2026-03-24')
  })
})

describe('isSameDay', () => {
  it('returns true for same Bangkok date', () => {
    expect(isSameDay('2026-03-25', '2026-03-25')).toBe(true)
  })
  it('returns false for different dates', () => {
    expect(isSameDay('2026-03-24', '2026-03-25')).toBe(false)
  })
})
