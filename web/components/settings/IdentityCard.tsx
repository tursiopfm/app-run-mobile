'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Camera, Mail } from 'lucide-react'
import { colors } from '@/lib/design/colors'

type Sex = 'male' | 'female' | 'other'
const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male',   label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'other',  label: 'Autre' },
]

type Props = {
  firstName:        string | null
  lastName:         string | null
  email:            string | null
  birthDate:        string | null   // ISO YYYY-MM-DD
  sex:              Sex | null
  avatarUrl:        string | null
  hasCustomAvatar:  boolean
  accountCreatedAt: string | null
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function IdentityCard({
  firstName, lastName, email, birthDate, sex, avatarUrl,
  hasCustomAvatar, accountCreatedAt,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Avatar state (inline upload)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl)
  const [currentHasCustom, setCurrentHasCustom] = useState(hasCustomAvatar)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  // Form state
  const [first,   setFirst]   = useState(firstName ?? '')
  const [last,    setLast]    = useState(lastName  ?? '')
  const [bdate,   setBdate]   = useState(birthDate ?? '')
  const [sexVal,  setSexVal]  = useState<Sex | null>(sex)
  const [status, setStatus] = useState<Status>('idle')

  const initialSnapshot = JSON.stringify({
    first: firstName ?? '', last: lastName ?? '', bdate: birthDate ?? '', sex: sex ?? null,
  })
  const currentSnapshot = JSON.stringify({ first, last, bdate, sex: sexVal })
  const dirty = initialSnapshot !== currentSnapshot

  async function save() {
    setStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: first || null,
          last_name:  last  || null,
          birth_date: bdate || null,
          sex:        sexVal,
        }),
      })
      if (!res.ok) { setStatus('error'); return }
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
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

  const fullName = [first, last].filter(Boolean).join(' ').trim() || 'Athlète'

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[14px]">
      {/* ── Avatar + nom affiché ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => !avatarUploading && fileInputRef.current?.click()}
            className="w-16 h-16 rounded-full overflow-hidden bg-trail-surface border border-trail-border flex items-center justify-center relative group"
            aria-label="Changer la photo de profil"
          >
            {currentAvatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={currentAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              : <User size={24} className="text-trail-muted" />}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarUploading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={18} className="text-white" />}
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
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-trail-text truncate">{fullName}</p>
          <div className="flex items-center gap-1 mt-[2px]">
            <Mail size={11} className="text-trail-muted flex-shrink-0" />
            <p className="text-[12px] text-trail-muted truncate">{email ?? '—'}</p>
          </div>
          {currentHasCustom && !avatarUploading && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-[10px] text-trail-muted underline underline-offset-2 mt-[4px]"
            >
              Retirer la photo
            </button>
          )}
        </div>
      </div>

      {avatarError && (
        <p className="text-[11px] text-red-500">Erreur photo — réessayer</p>
      )}

      {/* ── Champs éditables ── */}
      <div className="space-y-[10px]">
        <div className="grid grid-cols-2 gap-[8px]">
          <Field label="Prénom">
            <input
              type="text"
              value={first}
              onChange={e => setFirst(e.target.value)}
              placeholder="Prénom"
              className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
            />
          </Field>
          <Field label="Nom">
            <input
              type="text"
              value={last}
              onChange={e => setLast(e.target.value)}
              placeholder="Nom"
              className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
            />
          </Field>
        </div>

        <Field label="Date de naissance">
          <input
            type="date"
            value={bdate}
            onChange={e => setBdate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
          />
        </Field>

        <Field label="Sexe">
          <div className="flex gap-[6px]">
            {SEX_OPTIONS.map(opt => {
              const active = sexVal === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSexVal(active ? null : opt.value)}
                  className={`flex-1 rounded-[8px] px-2 py-[6px] text-[12px] font-medium transition-colors border ${
                    active
                      ? 'bg-trail-primary/15 border-trail-primary text-trail-primary'
                      : 'bg-trail-surface border-trail-border text-trail-muted hover:text-trail-text'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {sexVal == null && (
            <p className="text-[10px] text-trail-muted/70 mt-[4px]">Non précisé</p>
          )}
        </Field>
      </div>

      {/* ── Bouton sauvegarde ── */}
      <button
        onClick={save}
        disabled={!dirty || status === 'saving'}
        className="w-full rounded-[10px] py-[10px] text-[13px] font-bold text-white transition-opacity"
        style={{
          backgroundColor: status === 'error' ? '#ef4444'
            : status === 'saved' ? '#4caf50'
            : colors.chargeOrange,
          opacity: (!dirty || status === 'saving') ? 0.5 : 1,
          cursor: (!dirty || status === 'saving') ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'saving' ? 'Enregistrement…'
          : status === 'saved' ? '✓ Enregistré'
          : status === 'error' ? 'Erreur — réessayer'
          : dirty ? 'Enregistrer les modifications'
          : 'Aucune modification'}
      </button>

      {/* ── Meta (lecture seule) ── */}
      <div className="grid grid-cols-2 gap-[8px] text-[12px] pt-[2px]">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-trail-muted mb-[4px]">
        {label}
      </p>
      {children}
    </div>
  )
}
