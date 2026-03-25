// lib/constants.ts
export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrase',
  'conjunction',
  'preposition',
  'pronoun',
  'interjection',
] as const

export type PartOfSpeech = typeof PARTS_OF_SPEECH[number]
