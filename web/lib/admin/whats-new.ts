export type Bullet = { emoji: string; label: string }

/**
 * Valide/normalise une liste de puces (formulaire admin ou payload API).
 * Garde uniquement les entrées { emoji, label } avec un label non vide (après trim).
 * L'emoji est optionnel.
 */
export function normalizeBullets(input: unknown): Bullet[] {
  if (!Array.isArray(input)) return []
  const out: Bullet[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const emoji = typeof rec.emoji === 'string' ? rec.emoji.trim() : ''
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    if (!label) continue
    out.push({ emoji, label })
  }
  return out
}

/** Le modal s'affiche s'il existe une pop-up active non encore vue par l'utilisateur. */
export function shouldShowPopup(
  active: { id: string } | null | undefined,
  seenId: unknown,
): boolean {
  return !!active && seenId !== active.id
}
