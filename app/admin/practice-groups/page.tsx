import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PracticeGroupsPage() {
  const service = createServiceClient()
  const { data: groups } = await service
    .from('practice_groups')
    .select('id, name, icon, is_active, practice_group_words(count)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Practice Groups</h2>
        <Link href="/admin/practice-groups/new"
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New Group
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Group</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Words</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(groups ?? []).map(g => {
              const wordCount = (g.practice_group_words as unknown as { count: number }[])?.[0]?.count ?? 0
              return (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <span className="mr-2">{g.icon}</span>{g.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{wordCount} / 20</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.is_active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/practice-groups/${g.id}`} className="text-purple-600 hover:underline text-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(groups ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No groups yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
