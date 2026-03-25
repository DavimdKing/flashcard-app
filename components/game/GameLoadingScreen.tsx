export default function GameLoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <span className="text-5xl animate-bounce">🌸</span>
      <p className="text-purple-400 font-medium">Loading today's cards…</p>
    </div>
  )
}
