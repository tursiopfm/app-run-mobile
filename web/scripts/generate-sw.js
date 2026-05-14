#!/usr/bin/env node
/**
 * Génère public/sw.js depuis scripts/sw.template.js en injectant une VERSION
 * unique par build (SHA du commit). Sans ça, le SW garde sa version codée
 * en dur et continue à servir des chunks JS obsolètes après un déploiement
 * — ce qui gèle silencieusement le router Next.js côté client (cf. incident
 * 2026-05-14 : tap sur BottomNav sans effet après visite d'une page lourde).
 *
 * Source de la VERSION, par priorité :
 *   1. VERCEL_GIT_COMMIT_SHA  (défini automatiquement par Vercel)
 *   2. `git rev-parse HEAD`   (build local depuis un repo git)
 *   3. Date.now()             (fallback)
 *
 * Exécuté automatiquement par scripts/build.js avant `next build`.
 */
const { execSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const TEMPLATE = join(__dirname, 'sw.template.js')
const OUTPUT   = join(__dirname, '..', 'public', 'sw.js')

function resolveVersion() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8)
  }
  try {
    return execSync('git rev-parse --short=8 HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return `t${Date.now()}`
  }
}

const version = resolveVersion()
const template = readFileSync(TEMPLATE, 'utf8')
const output = template.replace('__SW_VERSION__', version)
writeFileSync(OUTPUT, output)
console.log(`[generate-sw] VERSION=${version} → public/sw.js`)
