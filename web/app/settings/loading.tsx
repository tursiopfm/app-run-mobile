import { AppShell } from '@/components/navigation/AppShell'

export default function Loading() {
  return (
    <AppShell>
      <div className="px-2 py-2 space-y-3 max-w-lg mx-auto animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[12px] bg-trail-card border border-trail-border p-4">
            <div className="h-3 w-28 rounded bg-trail-border mb-4" />
            <div className="h-8 rounded bg-trail-border mb-2" />
            <div className="h-8 rounded bg-trail-border" />
          </div>
        ))}
      </div>
    </AppShell>
  )
}
