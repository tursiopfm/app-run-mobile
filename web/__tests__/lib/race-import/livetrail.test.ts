/**
 * Tests pour le parser LiveTrail.
 * Fixture XML = réponse réelle d'https://ultramarin-breizhchrono.livetrail.run/parcours.php
 * Contient 2 blocs <points> (GdRaid + Raid) pour tester la sélection.
 */
import {
  livetrailParser,
  extractSlugAndRaceId,
  LivetrailError,
} from '@/lib/race-import/sources/livetrail'

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="parcours.xsl.php"?><d>
  <courses submit="changeCourse()">
    <c id="GdRaid" n="Grand Raid" nc="Grand Raid" color="#f5c700" />
    <c id="Raid" n="Raid" nc="Raid" color="#3399ff" sel="1"/>
    <c id="Arvor" n="Arvor" nc="Arvor" color="#d44a44" />
  </courses>
  <points course="GdRaid">
    <pt idpt="0" n="Port de Vannes" nc=" Vannes" km="0" d="0" a="3" lon="-2.75848" lat="47.65272" hp="26-19:00" hd="26-19:00" b="" meet="1" />
    <pt idpt="2" n="Séné Barrarac'h - Vendredi" nc="Séné Barra" km="14.81" d="93" a="2" lon="-2.77576" lat="47.62545" hp="26-19:52" hd="26-21:25" b="26-22:30" meet="1" />
    <pt idpt="6" n="Séné Cousteau " nc="Séné " km="28.86" d="200" a="18" lon="-2.71969" lat="47.64679" hp="26-20:49" hd="26-23:57" b="27-01:00" t="D" meet="1" />
    <pt idpt="8" n="Le Hézo Ecole Vert Marine" nc="Le Hézo " km="44.31" d="300" a="1" lon="-2.69489" lat="47.58330" hp="26-21:56" hd="27-03:08" b="27-03:00" t="D" meet="1" />
    <pt idpt="10" n="Sarzeau Salle Cosec" nc="Sarzeau" km="60.44" d="398" a="22" lon="-2.75985" lat="47.52540" hp="26-23:11" hd="27-06:39" b="27-07:00" meet="1" />
    <pt idpt="12" n="S Gildas de Rhuys - Govelins" nc="S Gildas d" km="76.88" d="560" a="3" lon="-2.84795" lat="47.51548" hp="27-00:40" hd="27-10:25" b="27-10:30" meet="1" />
    <pt idpt="14" n="Arzon Stade Chapron" nc="Arzon Stad" km="91.13" d="660" a="12" lon="-2.90090" lat="47.55464" hp="27-01:56" hd="27-13:59" b="27-14:00" t="D" meet="1" />
    <pt idpt="16" n="Arzon Port Navalo" nc="Arzon Port" km="93.77" d="683" a="2" lon="-2.91617" lat="47.54854" hp="27-02:11" hd="27-14:44" b="27-15:00" meet="1" />
    <pt idpt="18" n="Locmariaquer Le Guilvin" nc="Le Guilvin" km="97.13" d="686" a="3" lon="-2.93737" lat="47.56717" hp="27-02:28" hd="27-15:30" b="" meet="1" />
    <pt idpt="20" n="Crac'h Espace Les Chênes" nc="Crac'h " km="106.95" d="763" a="22" lon="-3.00408" lat="47.62280" hp="27-03:22" hd="27-18:05" b="27-17:30" t="D" meet="1" />
    <pt idpt="22" n="Le Bono Port" nc="Bono Port" km="122.72" d="898" a="5" lon="-2.95116" lat="47.64060" hp="27-04:47" hd="27-22:16" b="27-21:30" t="D" meet="1" />
    <pt idpt="28" n="Arradon Gilles Gahinet" nc="Arradon" km="156.89" d="1266" a="20" lon="-2.83033" lat="47.62716" hp="27-08:04" hd="28-07:42" b="28-07:30" meet="1" />
    <pt idpt="40" n="Pont de Kerino " nc=" Kerino " km="175.64" d="1431" a="3" lon="-2.76152" lat="47.64094" hp="27-09:52" hd="28-12:40" b="" meet="1" />
    <pt idpt="100" n="Arrivée" nc="Vannes" km="177.17" d="1431" a="3" lon="-2.75853" lat="47.65364" hp="27-10:01" hd="28-13:00" b="28-13:00" meet="1" />
  </points>
  <points course="Raid">
    <pt idpt="0" n="Plage des Govelins" nc="Govelins" km="0" d="0" a="5" lon="-2.84699" lat="47.51464" hp="25-12:00" hd="25-12:00" b="" meet="1" />
    <pt idpt="100" n="Arrivée" nc="Vannes" km="103.4" d="778" a="3" lon="-2.75848" lat="47.65273" hp="25-18:59" hd="26-08:01" b="26-09:15" meet="1" />
  </points>
</d>`

// Fixture XML avec un seul <pt> pour vérifier le garde-fou Array.isArray.
const FIXTURE_SINGLE_PT = `<?xml version="1.0" encoding="UTF-8"?>
<d>
  <points course="Solo">
    <pt idpt="0" n="Départ" km="0" d="0" b="" />
  </points>
</d>`

function mockFetchOnce(xml: string) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: async () => xml,
  } as any)
}

describe('livetrailParser.match()', () => {
  it('matche les URLs v3.livetrail.net', () => {
    expect(
      livetrailParser.match(
        'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
      ),
    ).toBe(true)
  })

  it('matche les URLs livetrail.net legacy', () => {
    expect(
      livetrailParser.match(
        'https://ultramarin-breizhchrono.livetrail.net/parcours.php?course=GdRaid',
      ),
    ).toBe(true)
  })

  it('matche les URLs livetrail.run', () => {
    expect(
      livetrailParser.match(
        'https://ultramarin-breizhchrono.livetrail.run/parcours.php?course=GdRaid',
      ),
    ).toBe(true)
  })

  it("rejette les URLs hors livetrail", () => {
    expect(livetrailParser.match('https://www.utmbmontblanc.com/fr/page/349/CCC.html'))
      .toBe(false)
    expect(livetrailParser.match('https://www.ultra-marin.fr/grand-raid-ultramarin'))
      .toBe(false)
  })
})

describe('extractSlugAndRaceId()', () => {
  it('extrait depuis URL v3 (path /races/{id})', () => {
    const out = extractSlugAndRaceId(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    expect(out).toEqual({ slug: 'ultramarin-breizhchrono', raceId: 'GdRaid' })
  })

  it('extrait depuis URL legacy (?course=)', () => {
    const out = extractSlugAndRaceId(
      'https://ultramarin-breizhchrono.livetrail.run/parcours.php?course=GdRaid',
    )
    expect(out).toEqual({ slug: 'ultramarin-breizhchrono', raceId: 'GdRaid' })
  })

  it("jette si raceId absent de l'URL", () => {
    expect(() =>
      extractSlugAndRaceId('https://ultramarin-breizhchrono.livetrail.net/'),
    ).toThrow(LivetrailError)
  })

  it("jette si URL invalide", () => {
    expect(() => extractSlugAndRaceId('pas-une-url')).toThrow(LivetrailError)
  })
})

describe('livetrailParser.parse()', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renvoie EXACTEMENT 14 waypoints pour GdRaid (pas un mélange avec Raid)', async () => {
    mockFetchOnce(FIXTURE_XML)
    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    expect(out.waypoints).toHaveLength(14)
  })

  it('mappe correctement waypoint[1] (Séné Barrarac\'h)', async () => {
    mockFetchOnce(FIXTURE_XML)
    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    const wp = out.waypoints[1]
    expect(wp.name).toBe("Séné Barrarac'h - Vendredi")
    expect(wp.km).toBe(14.81)
    expect(wp.dPlus).toBe(93)
    expect(wp.cutoffRaw).toBe('26-22:30')
    expect(wp.cutoffKind).toBe('clock_time')
  })

  it("dérive le D- cumulé depuis le D+ et l'altitude (XML sans colonne D-)", async () => {
    mockFetchOnce(FIXTURE_XML)
    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    // Départ (Port de Vannes, a=3) = altitude de référence → D- = 0.
    expect(out.waypoints[0].dMoins).toBe(0)
    // Séné Barrarac'h : d=93, a=2, a0=3 → 93 − (2−3) = 94.
    expect(out.waypoints[1].dMoins).toBe(94)
    // Arrivée (a=3 = a0) → D- = D+ = 1431.
    expect(out.waypoints[13].dMoins).toBe(1431)
  })

  it('force depart sur le premier waypoint et arrivee sur le dernier', async () => {
    mockFetchOnce(FIXTURE_XML)
    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    expect(out.waypoints[0].type).toBe('depart')
    expect(out.waypoints[13].type).toBe('arrivee')
    expect(out.waypoints[13].cutoffRaw).toBe('28-13:00')
  })

  it('nullifie cutoffRaw ET cutoffKind quand b="" dans le XML', async () => {
    mockFetchOnce(FIXTURE_XML)
    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    // waypoint index 8 (Locmariaquer Le Guilvin, km=97.13) et 12 (Pont de Kerino, km=175.64) ont b=""
    const locma = out.waypoints.find((w) => w.name.includes('Locmariaquer'))
    const kerino = out.waypoints.find((w) => w.name.includes('Kerino'))
    expect(locma?.cutoffRaw).toBeNull()
    expect(locma?.cutoffKind).toBeNull()
    expect(kerino?.cutoffRaw).toBeNull()
    expect(kerino?.cutoffKind).toBeNull()
  })

  it('fallback sur .livetrail.net quand .livetrail.run échoue', async () => {
    let calls = 0
    global.fetch = jest.fn().mockImplementation((url: string) => {
      calls++
      if (calls === 1) {
        expect(url).toContain('.livetrail.run/parcours.php')
        return Promise.reject(new Error('ECONNREFUSED'))
      }
      expect(url).toContain('.livetrail.net/parcours.php')
      return Promise.resolve({ ok: true, text: async () => FIXTURE_XML } as any)
    })

    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    expect(calls).toBe(2)
    expect(out.waypoints).toHaveLength(14)
  })

  it('garde-fou : XML avec un seul <pt> renvoie 1 waypoint', async () => {
    mockFetchOnce(FIXTURE_SINGLE_PT)
    const out = await livetrailParser.parse(
      'https://test.livetrail.run/parcours.php?course=Solo',
    )
    expect(out.waypoints).toHaveLength(1)
    expect(out.waypoints[0].name).toBe('Départ')
    expect(out.waypoints[0].type).toBe('arrivee')
    // Note : avec 1 seul pt, validate force le dernier en arrivee.
  })

  it("jette si le bloc course demandé n'existe pas dans le XML", async () => {
    mockFetchOnce(FIXTURE_XML)
    await expect(
      livetrailParser.parse(
        'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/Inexistant',
      ),
    ).rejects.toThrow(LivetrailError)
  })
})
