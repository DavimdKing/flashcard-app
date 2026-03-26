export default function AccessDeniedPage() {
  const purchaseUrl = process.env.NEXT_PUBLIC_PURCHASE_URL ?? '#'
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-purple-50 p-6">
      <div className="bg-white rounded-3xl shadow-lg p-10 flex flex-col items-center gap-4 w-full max-w-sm text-center">
        <span className="text-5xl">🔒</span>
        <h1 className="text-2xl font-bold text-purple-700">You don't have access yet</h1>
        <p className="text-gray-500 text-sm">Purchase a subscription to unlock the flashcard game.</p>
        <a
          href={purchaseUrl}
          className="mt-2 w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-2xl transition"
        >
          Get Access
        </a>
      </div>
    </main>
  )
}
