// web/scripts/brand/ico.ts
// Assemble plusieurs PNG (16/32/48…) en un unique .ico (PNG embarqué — supporté
// par tous les navigateurs modernes). Format ICONDIR + ICONDIRENTRY + données PNG.
export function pngsToIco(images: { size: number; png: Buffer }[]): Buffer {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // réservé
  header.writeUInt16LE(1, 2) // type 1 = icône
  header.writeUInt16LE(count, 4) // nombre d'images

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  images.forEach((img, i) => {
    const b = i * 16
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b) // largeur (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1) // hauteur
    dir.writeUInt8(0, b + 2) // palette
    dir.writeUInt8(0, b + 3) // réservé
    dir.writeUInt16LE(1, b + 4) // plans de couleur
    dir.writeUInt16LE(32, b + 6) // bits par pixel
    dir.writeUInt32LE(img.png.length, b + 8) // taille des données
    dir.writeUInt32LE(offset, b + 12) // offset des données
    offset += img.png.length
  })

  return Buffer.concat([header, dir, ...images.map((i) => i.png)])
}
