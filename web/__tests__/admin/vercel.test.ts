import { parseVercelDeployment } from '@/lib/admin/vercel'

const RAW = {
  uid: 'dpl_abc123',
  url: 'trail-cockpit-abc.vercel.app',
  name: 'trail-cockpit',
  target: 'production',
  readyState: 'READY',
  meta: { githubCommitMessage: 'fix(web): correction bug', githubCommitSha: 'abc1234def' },
  createdAt: Date.now() - 2 * 3600 * 1000,
}

describe('parseVercelDeployment', () => {
  it('extrait les champs correctement', () => {
    const d = parseVercelDeployment(RAW)
    expect(d.uid).toBe('dpl_abc123')
    expect(d.environment).toBe('Production')
    expect(d.state).toBe('READY')
    expect(d.commitMessage).toBe('fix(web): correction bug')
    expect(d.commitHash).toBe('abc1234')
    expect(d.url).toBe('https://trail-cockpit-abc.vercel.app')
  })

  it('truncate commitHash à 7 caractères', () => {
    const d = parseVercelDeployment({ ...RAW, meta: { githubCommitSha: '0123456789abcdef' } })
    expect(d.commitHash).toBe('0123456')
  })

  it('retourne null pour url si target != production', () => {
    const d = parseVercelDeployment({ ...RAW, target: null })
    expect(d.url).toBeNull()
  })
})
