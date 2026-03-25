// app/admin/words/no-image/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

const PAGE_SIZE = 20

export default async function NoImagePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const service = createServiceClient()

  const { data: words } = await service
    .from('words')
    .select('id, english_word, thai_translation, part_of_speech, created_at')
    .is('image_url', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to)

  const isEmpty = !words || words.length === 0

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Words Without Images</h2>

      {isEmpty ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">All words have images.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">English</th>
                  <th className="text-left px-4 py-3">Thai</th>
                  <th className="text-left px-4 py-3">POS</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {words.map(w => (
                  <tr key={w.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{w.english_word}</td>
                    <td className="px-4 py-3 text-gray-500">{w.thai_translation}</td>
                    <td className="px-4 py-3 text-gray-400 italic">{w.part_of_speech ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">No image</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/words/${w.id}`}
                        className="text-purple-600 hover:underline text-sm font-medium"
                      >
                        Add Image
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 mt-4">
            {page > 1 && (
              <Link
                href={`/admin/words/no-image?page=${page - 1}`}
                className="px-3 py-1 rounded-xl bg-white shadow text-sm text-gray-600"
              >
                ← Prev
              </Link>
            )}
            <span className="text-sm text-gray-400 self-center">Page {page}</span>
            {(words?.length ?? 0) === PAGE_SIZE && (
              <Link
                href={`/admin/words/no-image?page=${page + 1}`}
                className="px-3 py-1 rounded-xl bg-white shadow text-sm text-gray-600"
              >
                Next →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
