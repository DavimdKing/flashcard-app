'use client'

export default function DeleteWordButton({ wordId }: { wordId: string }) {
  const handleDelete = async () => {
    if (!confirm('Soft-delete this word?')) return
    const res = await fetch(`/api/admin/words/${wordId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Delete failed')
      return
    }
    window.location.reload()
  }
  return (
    <button type="button" onClick={handleDelete} className="text-red-400 hover:underline text-sm">
      Delete
    </button>
  )
}
