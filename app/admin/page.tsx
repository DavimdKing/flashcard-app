import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import SettingsForm from '@/components/admin/SettingsForm'

export default async function AdminDashboard() {
  const service = createServiceClient()
  const today = toBangkokDateString()

  const [{ count: wordCount }, { data: todaySet }, { count: userCount }, { data: settings }] = await Promise.all([
    service.from('words').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
    service.from('daily_sets').select('published_at').eq('set_date', today).single(),
    service.from('users').select('*', { count: 'exact', head: true }).eq('is_approved', true),
    service.from('site_settings').select('random_exclusion_days').eq('id', 1).single(),
  ])

  const setStatus = !todaySet ? 'None' : todaySet.published_at ? 'Published' : 'Draft'
  const statusColor = setStatus === 'Published' ? 'text-green-600' : setStatus === 'Draft' ? 'text-yellow-600' : 'text-gray-400'
  const exclusionDays = settings?.random_exclusion_days ?? 7

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Active Words" value={String(wordCount ?? 0)} />
        <StatCard label="Today's Set" value={setStatus} valueClass={statusColor} />
        <StatCard label="Approved Users" value={String(userCount ?? 0)} />
      </div>
      <SettingsForm initialDays={exclusionDays} />
    </div>
  )
}

function StatCard({ label, value, valueClass = 'text-gray-800' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}
