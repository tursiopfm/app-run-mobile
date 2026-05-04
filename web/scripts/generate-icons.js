#!/usr/bin/env node
/**
 * Generates PWA icons (192×192 and 512×512) as PNG files.
 * Pure Node.js — no external dependencies.
 *
 * Design: dark bg (#0f1117) + orange rounded-rect (#f97316) + white mountain △
 */
const { deflateSync } = require('zlib')
const { writeFileSync, mkdirSync } = require('fs')
const path = require('path')

// ── PNG encoder ──────────────────────────────────────────────────────────────

function u32be(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0)
  return b
}

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return t
  })())
  let c = 0xFFFFFFFF
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii')
  const cd = Buffer.concat([tb, data])
  return Buffer.concat([u32be(data.length), tb, data, u32be(crc32(cd))])
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = chunk('IHDR', Buffer.concat([
    u32be(w), u32be(h),
    Buffer.from([8, 6, 0, 0, 0]), // 8-bit RGBA
  ]))
  const rows = []
  for (let y = 0; y < h; y++) {
    rows.push(Buffer.from([0])) // filter: None
    rows.push(rgba.slice(y * w * 4, (y + 1) * w * 4))
  }
  const idat = chunk('IDAT', deflateSync(Buffer.concat(rows)))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, idat, iend])
}

// ── Icon drawing ─────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t }

function generateIcon(size) {
  const rgba = Buffer.alloc(size * size * 4)

  const BG  = [15, 17, 23, 255]    // #0f1117
  const OG  = [249, 115, 22, 255]  // #f97316
  const WHT = [255, 255, 255, 255] // white

  // Fill background
  for (let i = 0; i < size * size; i++) {
    rgba[i*4]=BG[0]; rgba[i*4+1]=BG[1]; rgba[i*4+2]=BG[2]; rgba[i*4+3]=BG[3]
  }

  const pad  = size * 0.10   // 10% padding
  const r    = size * 0.20   // corner radius of the rounded rect
  const x0   = pad, x1 = size - pad
  const y0   = pad, y1 = size - pad

  function inRoundedRect(px, py) {
    const cx = Math.max(x0 + r, Math.min(x1 - r, px))
    const cy = Math.max(y0 + r, Math.min(y1 - r, py))
    const dx = px - cx, dy = py - cy
    return dx*dx + dy*dy <= r*r
  }

  // Draw orange rounded rect
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundedRect(x + 0.5, y + 0.5)) continue
      const i = (y * size + x) * 4
      rgba[i]=OG[0]; rgba[i+1]=OG[1]; rgba[i+2]=OG[2]; rgba[i+3]=OG[3]
    }
  }

  // Draw white mountain △ (equilateral-ish triangle)
  // Peak at 28%, base at 72%, width spans 20%–80%
  const px = size * 0.50  // peak x
  const py = size * 0.26  // peak y
  const bl = size * 0.20  // base left x
  const br = size * 0.80  // base right x
  const by = size * 0.72  // base y

  // Stroke width for anti-aliasing feel: fill solid triangle
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Parametric barycentric test
      const t  = (y - py) / (by - py)   // 0 at peak, 1 at base
      if (t < 0 || t > 1) continue
      const lx = lerp(px, bl, t)
      const rx = lerp(px, br, t)
      if (x + 0.5 < lx || x + 0.5 > rx) continue
      const i = (y * size + x) * 4
      rgba[i]=WHT[0]; rgba[i+1]=WHT[1]; rgba[i+2]=WHT[2]; rgba[i+3]=WHT[3]
    }
  }

  return rgba
}

// ── Main ─────────────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

for (const size of [192, 512]) {
  const rgba = generateIcon(size)
  const png  = encodePNG(size, size, rgba)
  const file = path.join(outDir, `icon-${size}.png`)
  writeFileSync(file, png)
  console.log(`Generated ${file} (${png.length} bytes)`)
}
