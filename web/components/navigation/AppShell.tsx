import { BottomNav } from './BottomNav'

type AppShellProps = {
  children: React.ReactNode
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-trail-bg">
      {title && (
        <header className="sticky top-0 z-40 bg-trail-bg/95 backdrop-blur border-b border-trail-border px-4 py-3">
          <h1 className="text-lg font-semibold text-trail-text">{title}</h1>
        </header>
      )}
      <main className="flex-1 pb-24 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
