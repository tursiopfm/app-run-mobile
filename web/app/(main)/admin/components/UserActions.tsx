'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UserActions({ userId, email }: { userId: string; email: string }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function deleteUser() {
    setLoading(true)
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    setLoading(false)
    setConfirm(false)
    router.refresh()
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs text-trail-danger underline mt-1"
      >
        Supprimer
      </button>
    )
  }

  return (
    <div className="flex gap-2 mt-1 items-center flex-wrap">
      <span className="text-xs text-trail-warning">Supprimer {email} ?</span>
      <button onClick={() => setConfirm(false)} className="text-xs text-trail-muted underline">Annuler</button>
      <button onClick={deleteUser} disabled={loading} className="text-xs text-trail-danger underline font-semibold">
        {loading ? '…' : 'Confirmer'}
      </button>
    </div>
  )
}
