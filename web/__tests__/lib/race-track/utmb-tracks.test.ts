import { deriveTracksUrl, extractGpxCandidates, selectGpxUrl } from '@/lib/race-track/utmb-tracks'

const HTML = `
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760605599/mallorca/GPX%20TRACKS/X/100_M_SDT_2025_9207594015.gpx">SDT - 100M</a>
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760537058/mallorca/GPX%20TRACKS/X/100_K_CPS_2025_7b5b1ae851.gpx">CPS - 100K</a>
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760537057/mallorca/GPX%20TRACKS/X/50_K_ETM_2025_4a4b7cc285.gpx">ETM - 50K</a>
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760537057/mallorca/GPX%20TRACKS/X/20_K_CDA_2025_9dc4d1c265.gpx">CDA - 20K</a>
`

describe('deriveTracksUrl', () => {
  it('dérive {event}.utmb.world/race/tracks depuis une URL de course UTMB', () => {
    expect(deriveTracksUrl('https://mallorca.utmb.world/en/races/100K'))
      .toBe('https://mallorca.utmb.world/race/tracks')
  })
  it('renvoie null hors UTMB', () => {
    expect(deriveTracksUrl('https://ut4m.livetrail.run/parcours.php?course=X')).toBeNull()
    expect(deriveTracksUrl('pas-une-url')).toBeNull()
  })
})

describe('extractGpxCandidates', () => {
  it('extrait 4 candidats avec leur distance en km (K direct, M en miles)', () => {
    const c = extractGpxCandidates(HTML)
    expect(c).toHaveLength(4)
    const byKm = Object.fromEntries(c.map((x) => [Math.round(x.km), x.url.split('/').pop()]))
    expect(byKm[50]).toContain('50_K_ETM')
    expect(byKm[100]).toContain('100_K_CPS')
    expect(byKm[20]).toContain('20_K_CDA')
    expect(byKm[161]).toContain('100_M_SDT') // 100 miles ≈ 160.9 km
  })
})

describe('selectGpxUrl', () => {
  it('choisit le candidat le plus proche de la distance officielle (50 km)', () => {
    expect(selectGpxUrl(HTML, 50)).toContain('50_K_ETM')
  })
  it('matche 100 miles pour une course de ~160 km', () => {
    expect(selectGpxUrl(HTML, 160)).toContain('100_M_SDT')
  })
  it('renvoie null si aucun candidat à moins de 15% (course de 5 km)', () => {
    expect(selectGpxUrl(HTML, 5)).toBeNull()
  })
  it('renvoie null si la page ne contient aucun GPX', () => {
    expect(selectGpxUrl('<html>rien</html>', 50)).toBeNull()
  })
})
