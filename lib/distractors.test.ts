import { buildMultipleChoiceWords } from './distractors'

const makeWord = (word_id: string, thai_translation: string) => ({
  word_id,
  english_word: 'test',
  thai_translation,
  part_of_speech: null as string | null,
  image_url: null as string | null,
  audio_url: null as string | null,
  english_example: null as string | null,
  thai_example: null as string | null,
})

describe('buildMultipleChoiceWords', () => {
  it('returns exactly 4 choices per word', () => {
    const words = [makeWord('w1', 'correct')]
    const pool = ['a', 'b', 'c', 'd', 'e']
    const result = buildMultipleChoiceWords(words, pool)
    expect(result[0].choices).toHaveLength(4)
  })

  it('always includes the correct answer in choices', () => {
    const words = [makeWord('w1', 'correct')]
    const pool = ['a', 'b', 'c']
    const result = buildMultipleChoiceWords(words, pool)
    expect(result[0].choices).toContain('correct')
  })

  it('does not use the correct answer string as a distractor (when candidates available)', () => {
    const words = [makeWord('w1', 'correct')]
    const pool = ['a', 'b', 'c', 'd']
    const result = buildMultipleChoiceWords(words, pool)
    const count = result[0].choices.filter(c => c === 'correct').length
    expect(count).toBe(1)
  })

  it('shuffles choices — correct answer not always at index 0', () => {
    const words = [makeWord('w1', 'correct')]
    const pool = ['a', 'b', 'c']
    const positions = new Set<number>()
    for (let i = 0; i < 50; i++) {
      const result = buildMultipleChoiceWords(words, pool)
      positions.add(result[0].choices.indexOf('correct'))
    }
    expect(positions.size).toBeGreaterThan(1)
  })

  it('pads with repeats when fewer than 3 unique candidates exist', () => {
    const words = [makeWord('w1', 'correct')]
    const pool = ['only']   // 1 unique candidate after filtering 'correct'
    const result = buildMultipleChoiceWords(words, pool)
    expect(result[0].choices).toHaveLength(4)
    expect(result[0].choices).toContain('correct')
  })

  it('falls back to unfiltered pool when all pool entries equal the word translation', () => {
    const words = [makeWord('w1', 'same')]
    const pool = ['same', 'same', 'same']
    const result = buildMultipleChoiceWords(words, pool)
    expect(result[0].choices).toHaveLength(4)
    expect(result[0].choices).toContain('same')
  })

  it('copies all word fields through to the result', () => {
    const word = makeWord('w1', 'correct')
    const result = buildMultipleChoiceWords([word], ['a', 'b', 'c'])
    expect(result[0].word_id).toBe('w1')
    expect(result[0].english_word).toBe('test')
    expect(result[0].thai_translation).toBe('correct')
  })

  it('handles multiple words independently', () => {
    const words = [makeWord('w1', 'one'), makeWord('w2', 'two')]
    const pool = ['a', 'b', 'c', 'd']
    const result = buildMultipleChoiceWords(words, pool)
    expect(result).toHaveLength(2)
    expect(result[0].choices).toContain('one')
    expect(result[1].choices).toContain('two')
  })
})
