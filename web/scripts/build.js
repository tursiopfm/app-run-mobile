#!/usr/bin/env node
/**
 * Cross-platform build wrapper.
 * On Windows, Next.js 14 may fail on first run with ENOTEMPTY when trying to
 * rmdir .next/export (Node 20 regression). We retry once after cleaning up.
 */
const { execFileSync } = require('child_process')
const { rmSync } = require('fs')
const { join } = require('path')

const nextBin = require.resolve('next/dist/bin/next')
const opts = { stdio: 'inherit', cwd: join(__dirname, '..') }

function build() {
  execFileSync(process.execPath, [nextBin, 'build'], opts)
}

try {
  build()
} catch {
  try {
    rmSync(join(__dirname, '..', '.next', 'export'), { recursive: true, force: true })
  } catch {}
  build()
}
