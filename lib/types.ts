export type OAuthProvider = 'google' | 'facebook'
export type GradeResult = 'got_it' | 'nope'

export interface Word {
  id: string
  english_word: string
  thai_translation: string
  image_url: string | null
  audio_url: string | null
  part_of_speech: string | null
  english_example: string | null
  thai_example: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface DailySetWord extends Word {
  position: number
  word_id: string
}

export interface DailySet {
  id: string
  set_date: string
  published_at: string | null
  created_at: string
}

export interface AppUser {
  id: string
  email: string
  oauth_provider: OAuthProvider
  is_approved: boolean
  is_admin: boolean
  created_at: string
}

export interface ProgressResult {
  word_id: string
  result: GradeResult
}

export interface DailySetResponse {
  set_id: string
  set_date: string
  words: Array<{
    word_id: string
    position: number
    english_word: string
    thai_translation: string
    image_url: string | null
    audio_url: string | null
    part_of_speech: string | null
    english_example: string | null
    thai_example: string | null
  }>
}

export interface ProgressResponse {
  set_id: string
  results: ProgressResult[]
  total: number
  graded: number
}

export interface SiteSettings {
  id: 1
  random_exclusion_days: number
}

export interface PracticeGroupSummary {
  id: string
  name: string
  icon: string
  word_count: 20
  best_score: number | null
}

export interface MistakeWord {
  word_id: string
  english_word: string
  part_of_speech: string | null
  thai_translation: string
  english_example: string | null
  thai_example: string | null
  image_url: string | null
  audio_url: string | null
  created_at: string
}
