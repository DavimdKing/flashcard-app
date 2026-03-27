'use client'

import { useState, useEffect } from 'react'
import PracticeGroupGrid from '@/components/practice/PracticeGroupGrid'
import PracticeGroupList from '@/components/practice/PracticeGroupList'
import WordPreviewDrawer from '@/components/practice/WordPreviewDrawer'
import type { PracticeGroupSummary } from '@/lib/types'

const STORAGE_KEY = 'practice-view'

export default function PracticeHubClient({ groups }: { groups: PracticeGroupSummary[] }) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Read localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'list') setView('list')
  }, [])

  const toggle = () => {
    const next = view === 'grid' ? 'list' : 'grid'
    setView(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const previewGroup = previewId ? groups.find((g) => g.id === previewId) ?? null : null

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📚</p>
        <p>No practice groups available yet.</p>
      </div>
    )
  }

  return (
    <>
      {view === 'grid' ? (
        <PracticeGroupGrid
          groups={groups}
          onToggle={toggle}
          onPreview={setPreviewId}
        />
      ) : (
        <PracticeGroupList
          groups={groups}
          onToggle={toggle}
          onPreview={setPreviewId}
        />
      )}

      {previewGroup && (
        <WordPreviewDrawer
          groupId={previewGroup.id}
          groupName={previewGroup.name}
          groupIcon={previewGroup.icon}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  )
}
