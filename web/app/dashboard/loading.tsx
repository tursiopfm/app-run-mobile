import { AppShell } from '@/components/navigation/AppShell'

function SkeletonCard({ rows = 1 }: { rows?: number }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] animate-pulse">
      <div className="h-3 w-24 rounded bg-trail-border mb-3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-trail-border mb-2 last:mb-0" />
      ))}
    </div>
  )
}

export default function Loading() {
  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={2} />
        <SkeletonCard rows={3} />
        <SkeletonCard rows={1} />
        <SkeletonCard rows={2} />
      </div>
    </AppShell>
  )
}
