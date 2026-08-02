import { withTimeout } from '@/lib/push/browser'

// Logique pure : aucune API navigateur mockée. Minuteurs simulés pour ne pas
// faire attendre la suite (le vrai délai est de plusieurs secondes).
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('se résout avec la valeur quand la promesse tient dans le délai', async () => {
  const result = withTimeout(Promise.resolve('valeur'), 1000, 'repli')
  await Promise.resolve() // laisse la microtask de resolve() s'exécuter
  await expect(result).resolves.toBe('valeur')
})

it('se résout avec le repli, sans laisser de rejet non géré, quand la promesse enveloppée rejette', async () => {
  // Avant le correctif, l'exécuteur n'appelait jamais reject() et .then()
  // n'avait pas de onRejected : ce test échouait par timeout Jest (la
  // promesse ne se résolvait jamais avant l'écoulement du minuteur simulé,
  // et le rejet de `rejected` partait en rejet non géré).
  const rejected = Promise.reject(new Error('boom'))
  const result = withTimeout(rejected, 1000, 'repli')
  await expect(result).resolves.toBe('repli')
})

it('se résout avec le repli au déclenchement du minuteur si la promesse ne tranche jamais', async () => {
  const neverSettles = new Promise<string>(() => {})
  const result = withTimeout(neverSettles, 1000, 'repli')
  jest.advanceTimersByTime(1000)
  await expect(result).resolves.toBe('repli')
})
