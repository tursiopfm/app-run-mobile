export default function Loading() {
  return (
    <div className="px-2 py-2 space-y-2 max-w-lg md:max-w-4xl mx-auto animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] h-20" />
      ))}
    </div>
  )
}
