import type { MultipleChoiceWord } from './types'

type SessionWord = {
  word_id: string
  english_word: string
  thai_translation: string
  part_of_speech: string | null
  image_url: string | null
  audio_url: string | null
  english_example: string | null
  thai_example: string | null
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildMultipleChoiceWords(
  sessionWords: SessionWord[],
  pool: string[]
): MultipleChoiceWord[] {
  return sessionWords.map(word => {
    // Filter out strings that equal the correct answer; fall back to full pool if all match
    const candidates = pool.filter(t => t !== word.thai_translation)
    const source = candidates.length > 0 ? candidates : pool

    // Pick 3 distractors, repeating from source if needed
    const shuffledSource = fisherYates(source)
    const distractors: string[] = []
    for (let i = 0; distractors.length < 3; i++) {
      distractors.push(shuffledSource[i % shuffledSource.length])
    }

    const choices = fisherYates([word.thai_translation, ...distractors])
    return { ...word, choices }
  })
}
