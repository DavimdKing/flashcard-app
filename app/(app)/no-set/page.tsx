export default function NoSetPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-purple-50 p-6">
      <div className="bg-white rounded-3xl shadow-lg p-10 flex flex-col items-center gap-4 w-full max-w-sm text-center">
        <span className="text-5xl">📭</span>
        <h1 className="text-2xl font-bold text-purple-700">No new cards today</h1>
        <p className="text-gray-500 text-sm">Check back soon — a new set will be published shortly!</p>
      </div>
    </main>
  )
}
