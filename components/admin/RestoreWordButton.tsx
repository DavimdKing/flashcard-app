'use client'

export default function RestoreWordButton({ wordId }: { wordId: string }) {
  const handleRestore = async () => {
    const res = await fetch(`/api/admin/words/${wordId}/restore`, { method: 'POST' })
    if (!res.ok) {
      alert('Restore failed')
      return
    }
    window.location.reload()
  }
  return (
    <button type="button" onClick={handleRestore} className="text-green-600 hover:underline text-sm">
      Restore
    </button>
  )
}
