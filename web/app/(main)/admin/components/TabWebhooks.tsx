import { createServiceClient } from '@/lib/database/supabase-server'

async function fetchWebhookLogs() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('id, provider, event_type, user_id, status_code, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data ?? []
}

export async function TabWebhooks() {
  const logs = await fetchWebhookLogs()

  if (logs.length === 0) {
    return (
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 text-center">
        <p className="text-xs text-trail-muted">Aucun webhook enregistré pour l'instant.</p>
      </div>
    )
  }

  return (
    <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
      {logs.map(log => {
        const ok = (log.status_code ?? 200) < 500
        return (
          <div key={log.id} className="flex items-center justify-between px-4 py-3 gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-trail-text">{log.event_type}</p>
              <p className="text-xs text-trail-muted">{log.provider}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-semibold ${ok ? 'text-trail-success' : 'text-trail-danger'}`}>
                {ok ? '✓' : '✗'} {log.status_code ?? 200}
              </p>
              <p className="text-xs text-trail-muted">
                {new Date(log.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
