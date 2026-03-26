// components/dashboard/StatCard.tsx
interface Props {
  label: string
  value: string
  valueColor?: string
  placeholder?: boolean
}

export default function StatCard({ label, value, valueColor = 'text-purple-600', placeholder = false }: Props) {
  if (placeholder) {
    return (
      <div className="flex-1 bg-white rounded-2xl p-4 border border-dashed border-gray-200 opacity-60">
        <p className="text-xs text-gray-400 mb-1">Coming soon</p>
        <p className="text-sm text-gray-300">New feature</p>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
