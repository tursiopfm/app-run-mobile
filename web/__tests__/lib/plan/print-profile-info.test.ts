import { loadProfileInfo, saveProfileInfo, DEFAULT_PROFILE_INFO } from '@/lib/plan/print-profile-info'

describe('print-profile-info', () => {
  beforeEach(() => window.localStorage.clear())

  it('renvoie le défaut (tout activé) si rien en stockage', () => {
    expect(loadProfileInfo()).toEqual(DEFAULT_PROFILE_INFO)
    expect(DEFAULT_PROFILE_INFO).toEqual({ objectif: true, barriers: true, supplies: true, altitudes: true })
  })

  it('round-trip save → load', () => {
    saveProfileInfo({ objectif: false, barriers: false, supplies: true, altitudes: false })
    expect(loadProfileInfo()).toEqual({ objectif: false, barriers: false, supplies: true, altitudes: false })
  })

  it('retombe sur le défaut si le JSON stocké est corrompu', () => {
    window.localStorage.setItem('tc:plan:print-profile-info:v1', '{not json')
    expect(loadProfileInfo()).toEqual(DEFAULT_PROFILE_INFO)
  })
})
