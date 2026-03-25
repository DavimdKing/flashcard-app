'use client'

import { useEffect, useState } from 'react'
import type { AppUser } from '@/lib/types'

type ApprovalFilter = 'all' | 'approved' | 'pending'

export default function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all')

  useEffect(() => {
    fetch('/api/admin/users-list').then(r => r.json()).then(data => {
      setUsers(data)
      setLoading(false)
    })
  }, [])

  const update = async (id: string, patch: Partial<Pick<AppUser, 'is_approved' | 'is_admin'>>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) { alert(json.error); return }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  const filtered = users
    .filter(u => u.email.toLowerCase().includes(search.toLowerCase()))
    .filter(u => {
      if (approvalFilter === 'approved') return u.is_approved
      if (approvalFilter === 'pending') return !u.is_approved
      return true
    })

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Users</h2>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="border rounded-xl px-3 py-2 text-sm focus:outline-purple-400 w-64" />
        <select value={approvalFilter} onChange={e => setApprovalFilter(e.target.value as ApprovalFilter)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-purple-400">
          <option value="all">All users</option>
          <option value="approved">Approved only</option>
          <option value="pending">Pending approval</option>
        </select>
      </div>
      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Approved</th>
                <th className="text-left px-4 py-3">Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">{u.email}{isSelf && <span className="ml-1 text-xs text-purple-400">(you)</span>}</td>
                    <td className="px-4 py-3 capitalize">{u.oauth_provider}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => update(u.id, { is_approved: !u.is_approved })}
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${u.is_approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_approved ? 'Revoke' : 'Approve'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button"
                        onClick={() => update(u.id, { is_admin: !u.is_admin })}
                        disabled={isSelf && u.is_admin}
                        title={isSelf && u.is_admin ? 'Cannot remove your own admin status' : undefined}
                        className={`px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${u.is_admin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
