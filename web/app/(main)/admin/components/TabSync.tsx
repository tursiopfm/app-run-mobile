'use client'

import { useState } from 'react'

export function TabSync() {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function syncOne() {
    if (!selectedUserId.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId.trim() }),
      })
      const data = await res.json()
      setResult(data.results?.[0]?.status === 'ok' ? '✓ Sync réussie' : `✗ ${data.results?.[0]?.message ?? 'Erreur'}`)
    } catch {
      setResult('✗ Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function syncAll() {
    setShowConfirm(false)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      const data = await res.json()
      const ok = (data.results ?? []).filter((r: { status: string }) => r.status === 'ok').length
      const fail = (data.results ?? []).filter((r: { status: string }) => r.status === 'error').length
      setResult(`✓ ${ok} sync OK · ${fail} erreurs`)
    } catch {
      setResult('✗ Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sync individuelle */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-trail-accent">Sync individuelle</p>
        <p className="text-xs text-trail-muted">Saisir l&apos;UUID Supabase de l&apos;utilisateur</p>
        <input
          type="text"
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          placeholder="UUID utilisateur…"
          className="w-full bg-trail-surface border border-trail-border rounded-xl px-3 py-2 text-sm text-trail-text placeholder:text-trail-muted outline-none focus:border-trail-primary"
        />
        <button
          onClick={syncOne}
          disabled={loading || !selectedUserId.trim()}
          className="w-full bg-trail-primary text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Sync en cours…' : 'Sync →'}
        </button>
      </div>

      {/* Sync de masse */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-trail-danger">Sync de masse</p>
        <p className="text-xs text-trail-muted">Déclenche une sync Strava pour tous les utilisateurs connectés.</p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={loading}
            className="w-full bg-trail-danger text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
          >
            Sync tous ⚠
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-trail-warning font-semibold text-center">Confirmer la sync de masse ?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-trail-surface border border-trail-border text-trail-muted rounded-xl py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={syncAll}
                className="flex-1 bg-trail-danger text-white rounded-xl py-2 text-sm font-semibold"
              >
                Confirmer
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          result.startsWith('✓') ? 'bg-trail-success/10 text-trail-success' : 'bg-trail-danger/10 text-trail-danger'
        }`}>
          {result}
        </div>
      )}
    </div>
  )
}
