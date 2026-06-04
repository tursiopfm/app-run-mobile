export default function Loading() {
  return (
    <div className="px-2 py-2 space-y-2 max-w-lg md:max-w-none mx-auto animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
          <div className="h-3 w-20 rounded bg-trail-border mb-3" />
          <div className="h-12 rounded bg-trail-border" />
        </div>
      ))}
    </div>
  )
}
