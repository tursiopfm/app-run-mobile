import { pngsToIco } from '@/scripts/brand/ico'

describe('pngsToIco', () => {
  it('produit un conteneur ICO valide (en-tête + compte + offset)', () => {
    const fake = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // stub
    const ico = pngsToIco([
      { size: 16, png: fake },
      { size: 32, png: fake },
    ])
    expect(ico.readUInt16LE(0)).toBe(0) // réservé
    expect(ico.readUInt16LE(2)).toBe(1) // type 1 = icône
    expect(ico.readUInt16LE(4)).toBe(2) // 2 images
    // premier offset de données = 6 (header) + 16*2 (dir) = 38
    expect(ico.readUInt32LE(6 + 12)).toBe(38)
  })
})
