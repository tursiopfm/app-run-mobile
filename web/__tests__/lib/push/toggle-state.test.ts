import { pushToggleState, type PushEnvironment } from '@/lib/push/toggle-state'

const base: PushEnvironment = {
  supported:  true,
  standalone: true,
  iosLike:    false,
  permission: 'granted',
  subscribed: false,
}

it('affiche OFF quand tout est possible mais rien n\'est souscrit', () => {
  expect(pushToggleState(base)).toBe('off')
})

it('affiche ON quand un abonnement existe', () => {
  expect(pushToggleState({ ...base, subscribed: true })).toBe('on')
})

it('exige l\'installation sur iOS hors écran d\'accueil', () => {
  // Cas critique : sur iOS Safari, PushManager est ABSENT. Sans priorité sur
  // le cas iOS, on afficherait « hidden » et l'utilisateur n'apprendrait
  // jamais qu'il lui suffit d'installer la PWA.
  expect(pushToggleState({
    ...base, iosLike: true, standalone: false, supported: false, permission: null,
  })).toBe('install-required')
})

it('affiche l\'interrupteur sur iOS une fois installée', () => {
  expect(pushToggleState({ ...base, iosLike: true, standalone: true })).toBe('off')
})

it('verrouille quand la permission a été refusée', () => {
  expect(pushToggleState({ ...base, permission: 'denied' })).toBe('denied')
})

it('masque tout sur un navigateur sans support push', () => {
  expect(pushToggleState({ ...base, supported: false, permission: null })).toBe('hidden')
})
