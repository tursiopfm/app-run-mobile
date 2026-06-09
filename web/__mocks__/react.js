// Jest mock for React: re-exports the standard React module but adds `cache`
// if missing (React 18 stable doesn't ship `cache`; Next.js 14 uses a canary
// that does, but Jest resolves the stable version).
const actualReact = jest.requireActual('react')

module.exports = {
  ...actualReact,
  // `cache` is a no-op identity in tests: the function is called once per test,
  // the React request-cache behaviour is irrelevant in a unit-test context.
  cache: actualReact.cache ?? ((fn) => fn),
}
