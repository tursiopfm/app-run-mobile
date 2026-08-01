import { parseBanResponse } from '@/lib/geo/ban-geocode'

describe('parseBanResponse', () => {
  it('cas nominal : label + inversion [lng, lat] → { lat, lng }', () => {
    const json = {
      features: [
        {
          properties: { label: '10 Rue de la Paix 75002 Paris' },
          geometry: { type: 'Point', coordinates: [2.3316, 48.8698] },
        },
      ],
    }
    expect(parseBanResponse(json)).toEqual([
      { label: '10 Rue de la Paix 75002 Paris', lat: 48.8698, lng: 2.3316 },
    ])
  })

  it('feature sans geometry ou sans label → ignorée, les valides restent', () => {
    const json = {
      features: [
        { properties: { label: 'Sans geometry' } },
        { geometry: { coordinates: [6.1296, 45.8992] } },
        {
          properties: { label: 'Annecy' },
          geometry: { coordinates: [6.1296, 45.8992] },
        },
      ],
    }
    expect(parseBanResponse(json)).toEqual([
      { label: 'Annecy', lat: 45.8992, lng: 6.1296 },
    ])
  })

  it('coordinates non numériques ou trop courtes → ignorée', () => {
    const json = {
      features: [
        { properties: { label: 'X' }, geometry: { coordinates: ['a', 'b'] } },
        { properties: { label: 'Y' }, geometry: { coordinates: [6.1] } },
      ],
    }
    expect(parseBanResponse(json)).toEqual([])
  })

  it('json non conforme (null, objet vide, features non-tableau) → []', () => {
    expect(parseBanResponse(null)).toEqual([])
    expect(parseBanResponse({})).toEqual([])
    expect(parseBanResponse({ features: 'nope' })).toEqual([])
  })
})
