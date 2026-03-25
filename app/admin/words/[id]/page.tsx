import { createServiceClient } from '@/lib/supabase/service'
import WordForm from '@/components/admin/WordForm'
import { notFound } from 'next/navigation'

export default async function EditWordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()
  const { data: word } = await service.from('words').select('*').eq('id', id).single()
  if (!word) notFound()
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Word</h2>
      <WordForm word={word} />
    </div>
  )
}
