import { AppShell } from '@/components/navigation/AppShell'

export default function Loading() {
  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] h-20" />
        ))}
      </div>
    </AppShell>
  )
}
