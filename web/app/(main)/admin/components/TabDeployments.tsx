import { fetchVercelDeployments } from '@/lib/admin/vercel'
import { formatDateTime } from '@/lib/admin/format'

const STATE_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  READY:    { color: 'text-trail-success', dot: 'bg-trail-success', label: 'Ready' },
  ERROR:    { color: 'text-trail-danger',  dot: 'bg-trail-danger',  label: 'Error' },
  BUILDING: { color: 'text-trail-warning', dot: 'bg-trail-warning', label: 'Building' },
  CANCELED: { color: 'text-trail-muted',   dot: 'bg-trail-muted',   label: 'Canceled' },
}

export async function TabDeployments() {
  const deployments = await fetchVercelDeployments()

  if (deployments.length === 0) {
    return (
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 text-center">
        <p className="text-xs text-trail-muted">
          Aucun déploiement — vérifier VERCEL_TOKEN et VERCEL_PROJECT_ID
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {deployments.map(d => {
        const cfg = STATE_CONFIG[d.state] ?? STATE_CONFIG.CANCELED
        return (
          <div key={d.uid} className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-sm font-semibold text-trail-text">{d.environment}</span>
              </div>
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-xs text-trail-muted truncate">{d.commitMessage}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-trail-muted font-mono">{d.commitHash}</span>
              <span className="text-xs text-trail-muted">{formatDateTime(new Date(d.createdAt).toISOString())}</span>
            </div>
            {d.url && (
              <a href={d.url} target="_blank" rel="noreferrer"
                className="text-xs text-trail-primary underline">
                ↗ {d.url.replace('https://', '')}
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
