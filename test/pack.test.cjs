'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const starter = path.join(root, 'src', 'packs', 'starter.loops.json')
const packFormat = path.join(root, 'src', 'lib', 'packFormat.ts')

function run(expr) {
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '-e', expr],
    { encoding: 'utf8', cwd: root },
  )
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'packFormat failed')
  return r.stdout
}

describe('starter .loops.json pack', () => {
  it('contains ready-to-import starter loops', () => {
    const pack = JSON.parse(fs.readFileSync(starter, 'utf8'))
    assert.equal(pack.kind, 'loops-pack')
    assert.equal(pack.version, 1)
    assert.equal(pack.loops.length >= 2, true)
    assert.equal(pack.loops.some((l) => l.id === 'fix-tests'), true)
    assert.equal(typeof pack.loops[0].payload.goal, 'string')
  })

  it('round-trips the starter pack and rejects empty or invalid files', () => {
    const starterUrl = 'file://' + starter
    const modUrl = 'file://' + packFormat
    const out = run(`
      import { readFileSync } from 'node:fs';
      import { parsePack, serializePack } from ${JSON.stringify(modUrl)};
      const text = readFileSync(${JSON.stringify(starter)}, 'utf8');
      const pack = parsePack(text);
      const again = parsePack(serializePack(pack));
      console.log(JSON.stringify({ count: pack.loops.length, again: again.loops.length, first: pack.loops[0].id }));
      try { parsePack('{"kind":"loops-pack","version":1,"loops":[]}'); console.log('EMPTY_OK'); }
      catch { console.log('EMPTY_ERR'); }
      try { parsePack('not-json'); console.log('BAD_OK'); }
      catch { console.log('BAD_ERR'); }
    `)
    const data = JSON.parse(out.trim().split('\n')[0])
    assert.equal(data.count, data.again)
    assert.equal(data.count >= 2, true)
    assert.match(out, /EMPTY_ERR/)
    assert.match(out, /BAD_ERR/)
  })
})
