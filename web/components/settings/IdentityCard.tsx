'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Pencil, Camera, X, Check } from 'lucide-react'

type Props = {
  firstName:        string | null
  lastName:         string | null
  email:            string | null
  avatarUrl:        string | null
  hasCustomAvatar:  boolean
  accountCreatedAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function IdentityCard({
  firstName, lastName, email, avatarUrl, hasCustomAvatar, accountCreatedAt,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl)
  const [currentHasCustom, setCurrentHasCustom] = useState(hasCustomAvatar)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editFirst, setEditFirst] = useState(firstName ?? '')
  const [editLast, setEditLast]   = useState(lastName ?? '')
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  const [displayFirst, setDisplayFirst] = useState(firstName)
  const [displayLast, setDisplayLast]   = useState(lastName)

  const fullName = [displayFirst, displayLast].filter(Boolean).join(' ').trim() || 'Athlète'

  function handleEditStart() {
    setEditFirst(displayFirst ?? '')
    setEditLast(displayLast ?? '')
    setIsEditing(true)
    setNameStatus('idle')
  }

  function handleCancel() {
    setIsEditing(false)
    setNameStatus('idle')
  }

  async function handleSaveName() {
    setNameStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirst || null,
          last_name:  editLast  || null,
        }),
      })
      if (!res.ok) { setNameStatus('error'); return }
      setDisplayFirst(editFirst || null)
      setDisplayLast(editLast  || null)
      setIsEditing(false)
      setNameStatus('idle')
      router.refresh()
    } catch {
      setNameStatus('error')
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    setAvatarError(false)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        setCurrentAvatarUrl(url)
        setCurrentHasCustom(true)
        router.refresh()
      } else {
        setAvatarError(true)
      }
    } catch {
      setAvatarError(true)
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true)
    setAvatarError(false)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (res.ok) {
        setCurrentAvatarUrl(null)
        setCurrentHasCustom(false)
        router.refresh()
      } else {
        setAvatarError(true)
      }
    } catch {
      setAvatarError(true)
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[12px]">
      <p className="text-[14px] font-bold text-trail-text">Identité</p>

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => !avatarUploading && fileInputRef.current?.click()}
            className="w-14 h-14 rounded-full overflow-hidden bg-trail-surface border border-trail-border flex items-center justify-center relative group"
            aria-label="Changer la photo de profil"
          >
            {currentAvatarUrl
              ? <img src={currentAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : <User size={22} className="text-trail-muted" />}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarUploading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={16} className="text-white" />}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Nom — mode lecture ou édition */}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-[6px]">
              <div className="flex gap-[6px]">
                <input
                  type="text"
                  value={editFirst}
                  onChange={e => setEditFirst(e.target.value)}
                  placeholder="Prénom"
                  className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[4px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
                />
                <input
                  type="text"
                  value={editLast}
                  onChange={e => setEditLast(e.target.value)}
                  placeholder="Nom"
                  className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[4px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
                />
              </div>
              <div className="flex gap-[6px]">
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={nameStatus === 'saving'}
                  className="flex items-center gap-1 rounded-[8px] bg-trail-primary px-3 py-[4px] text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Check size={12} />
                  {nameStatus === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1 rounded-[8px] bg-trail-surface border border-trail-border px-3 py-[4px] text-[12px] text-trail-muted"
                >
                  <X size={12} />
                  Annuler
                </button>
              </div>
              {nameStatus === 'error' && (
                <p className="text-[11px] text-red-500">Erreur — réessayer</p>
              )}
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-trail-text truncate">{fullName}</p>
                <p className="text-[12px] text-trail-muted truncate">{email ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={handleEditStart}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[6px] hover:bg-trail-surface"
                aria-label="Modifier le nom"
              >
                <Pencil size={13} className="text-trail-muted" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar error */}
      {avatarError && (
        <p className="text-[11px] text-red-500">Erreur — réessayer</p>
      )}

      {/* Retirer avatar custom */}
      {currentHasCustom && !avatarUploading && (
        <button
          type="button"
          onClick={handleRemoveAvatar}
          className="text-[11px] text-trail-muted underline underline-offset-2"
        >
          Retirer la photo personnalisée
        </button>
      )}

      <div className="grid grid-cols-2 gap-[8px] text-[12px]">
        <div className="rounded-[10px] bg-trail-surface px-3 py-[8px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Compte créé</p>
          <p className="text-[13px] text-trail-text mt-[2px]">{formatDate(accountCreatedAt)}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[8px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Abonnement</p>
          <p className="text-[13px] text-trail-text mt-[2px]">Free</p>
        </div>
      </div>
    </div>
  )
}
