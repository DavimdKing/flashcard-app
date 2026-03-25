import SetBuilder from '@/components/admin/SetBuilder'
import { toBangkokDateString } from '@/lib/bangkok-date'

export const dynamic = 'force-dynamic'

export default function DailySetPage() {
  const today = toBangkokDateString()
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Today's Set</h2>
      <p className="text-sm text-gray-400 mb-6">{today} (Bangkok time)</p>
      <SetBuilder />
    </div>
  )
}
