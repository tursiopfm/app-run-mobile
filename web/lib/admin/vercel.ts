export interface VercelDeployment {
  uid: string
  environment: string
  state: string
  commitMessage: string
  commitHash: string
  url: string | null
  createdAt: number
}

export function parseVercelDeployment(raw: Record<string, unknown>): VercelDeployment {
  const meta = (raw.meta ?? {}) as Record<string, string>
  const sha = meta.githubCommitSha ?? ''
  return {
    uid: String(raw.uid ?? ''),
    environment: raw.target === 'production' ? 'Production' : 'Preview',
    state: String(raw.readyState ?? raw.state ?? ''),
    commitMessage: meta.githubCommitMessage ?? meta.commitMessage ?? '—',
    commitHash: sha.slice(0, 7),
    url: raw.target === 'production' ? `https://${raw.url}` : null,
    createdAt: Number(raw.createdAt ?? 0),
  }
}

export async function fetchVercelDeployments(): Promise<VercelDeployment[]> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return []

  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=10`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 60 } }
  )
  if (!res.ok) return []

  const json = await res.json()
  return (json.deployments ?? []).map(parseVercelDeployment)
}
