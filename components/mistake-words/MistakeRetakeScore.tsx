'use client'

import { useRouter } from 'next/navigation'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface Props {
  gotItWords: RetakeWord[]
  nopeWords: RetakeWord[]
}

export default function MistakeRetakeScore({ gotItWords, nopeWords }: Props) {
  const router = useRouter()
  const total = gotItWords.length + nopeWords.length

  return (
    <main className="flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full flex flex-col gap-6">
        {/* Score summary */}
        <div className="text-center">
          <p className="text-5xl font-extrabold text-purple-600">
            {gotItWords.length}/{total}
          </p>
          {gotItWords.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              {gotItWords.length} word{gotItWords.length !== 1 ? 's' : ''} cleared from your Mistake Words ✅
            </p>
          )}
          {nopeWords.length > 0 && (
            <p className="text-sm text-orange-500 mt-1">
              {nopeWords.length} word{nopeWords.length !== 1 ? 's' : ''} still remaining — keep practising!
            </p>
          )}
        </div>

        {/* Got it section */}
        {gotItWords.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="text-sm font-semibold text-green-700">Got it! · {gotItWords.length} cleared</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gotItWords.map(w => (
                <span key={w.word_id} className="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-lg font-medium border border-green-100">
                  {w.english_word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Nope section */}
        {nopeWords.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              <span className="text-sm font-semibold text-red-600">Nope · {nopeWords.length} still in Mistake Words</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {nopeWords.map(w => (
                <span key={w.word_id} className="bg-red-50 text-red-600 text-sm px-3 py-1 rounded-lg font-medium border border-red-100">
                  {w.english_word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push('/mistake-words')}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-sm transition"
        >
          ← Back to Mistake Words
        </button>
      </div>
    </main>
  )
}
