import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import DeleteWordButton from '@/components/admin/DeleteWordButton'
import RestoreWordButton from '@/components/admin/RestoreWordButton'

const PAGE_SIZE = 20

export default async function WordsPage({
  searchParams,
}: {
  searchParams: Promise<{ show_deleted?: string; q?: string; page?: string }>
}) {
  const params = await searchParams
  const service = createServiceClient()
  const showDeleted = params.show_deleted === '1'
  const query = params.q ?? ''
  const page = Number(params.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = service.from('words')
    .select('id, english_word, thai_translation, audio_url, image_url, is_deleted, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (!showDeleted) q = q.eq('is_deleted', false)
  if (query) q = q.ilike('english_word', `%${query}%`)

  const { data: words } = await q

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Word Database</h2>
        <Link href="/admin/words/new"
          className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-xl transition">
          + Add Word
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <form className="flex gap-2">
          <input name="q" defaultValue={query} placeholder="Search English…"
            className="border rounded-xl px-3 py-1.5 text-sm focus:outline-purple-400" />
          <button type="submit" className="text-sm text-purple-600 font-medium">Search</button>
        </form>
        <Link href={`/admin/words?show_deleted=${showDeleted ? '0' : '1'}&q=${query}`}
          className="text-sm text-gray-500 underline self-center">
          {showDeleted ? 'Hide deleted' : 'Show deleted'}
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">English</th>
              <th className="text-left px-4 py-3">Thai</th>
              <th className="text-left px-4 py-3">Audio</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(words ?? []).map(w => (
              <tr key={w.id} className={`border-t ${w.is_deleted ? 'opacity-40' : ''}`}>
                <td className="px-4 py-3 font-medium">{w.english_word}</td>
                <td className="px-4 py-3 text-gray-500">{w.thai_translation}</td>
                <td className="px-4 py-3">{w.audio_url ? '✅' : '❌'}</td>
                <td className="px-4 py-3 flex gap-2">
                  {!w.is_deleted && (
                    <>
                      <Link href={`/admin/words/${w.id}`} className="text-purple-600 hover:underline text-sm">Edit</Link>
                      <DeleteWordButton wordId={w.id} />
                    </>
                  )}
                  {w.is_deleted && <RestoreWordButton wordId={w.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4">
        {page > 1 && (
          <Link href={`/admin/words?page=${page - 1}&q=${query}&show_deleted=${showDeleted ? '1' : '0'}`}
            className="px-3 py-1 rounded-xl bg-white shadow text-sm text-gray-600">← Prev</Link>
        )}
        <span className="text-sm text-gray-400 self-center">Page {page}</span>
        {(words?.length ?? 0) === PAGE_SIZE && (
          <Link href={`/admin/words?page=${page + 1}&q=${query}&show_deleted=${showDeleted ? '1' : '0'}`}
            className="px-3 py-1 rounded-xl bg-white shadow text-sm text-gray-600">Next →</Link>
        )}
      </div>
    </div>
  )
}
