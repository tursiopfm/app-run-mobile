import { normalizeBullets, shouldShowPopup } from '@/lib/admin/whats-new'

describe('normalizeBullets', () => {
  it('garde les puces valides et trim emoji/label', () => {
    expect(normalizeBullets([{ emoji: ' ✨ ', label: '  Nouveau  ' }]))
      .toEqual([{ emoji: '✨', label: 'Nouveau' }])
  })

  it('rejette label vide, non-objets, et autorise emoji vide', () => {
    expect(normalizeBullets([{ emoji: '✨', label: '' }, null, 'x', { emoji: '✨' }]))
      .toEqual([])
    expect(normalizeBullets([{ label: 'Sans emoji' }]))
      .toEqual([{ emoji: '', label: 'Sans emoji' }])
  })

  it('renvoie [] pour une entrée non-array', () => {
    expect(normalizeBullets('nope')).toEqual([])
    expect(normalizeBullets(undefined)).toEqual([])
  })
})

describe('shouldShowPopup', () => {
  it('faux quand aucune pop-up active', () => {
    expect(shouldShowPopup(null, 'x')).toBe(false)
    expect(shouldShowPopup(undefined, undefined)).toBe(false)
  })

  it("vrai quand l'id actif diffère du seen (ou seen absent)", () => {
    expect(shouldShowPopup({ id: 'abc' }, 'xyz')).toBe(true)
    expect(shouldShowPopup({ id: 'abc' }, undefined)).toBe(true)
  })

  it('faux quand déjà vu (id égal)', () => {
    expect(shouldShowPopup({ id: 'abc' }, 'abc')).toBe(false)
  })
})
