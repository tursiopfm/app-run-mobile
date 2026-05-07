export default function Loading() {
  return (
    <div className="px-2 py-2 space-y-2 max-w-lg mx-auto animate-pulse">
      <div className="h-3 w-32 rounded bg-trail-border mb-4" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-[12px] bg-trail-card border border-trail-border p-3 h-16" />
      ))}
    </div>
  )
}
