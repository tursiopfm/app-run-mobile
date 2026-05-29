import { findParserForUrl, registerParser, getRegisteredParsers } from '@/lib/race-import/sources'

describe('parser registry', () => {
  it('renvoie null si aucun parser ne match', () => {
    expect(findParserForUrl('https://livetrail.net/foo')).toBeNull()
  })

  it("liste vide par défaut", () => {
    expect(getRegisteredParsers()).toEqual([])
  })

  it('register + match', () => {
    const parser = {
      id: 'test-parser',
      match: (url: string) => url.includes('example.com'),
      parse: async () => ({ raceName: null, editionYear: null, waypoints: [] }),
    }
    registerParser(parser)
    expect(findParserForUrl('https://example.com/x')).toBe(parser)
    expect(findParserForUrl('https://other.com/x')).toBeNull()
  })
})
