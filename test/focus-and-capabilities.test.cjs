'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const css = fs.readFileSync(path.join(root, 'src', 'App.css'), 'utf8')
const cap = JSON.parse(
  fs.readFileSync(path.join(root, 'src-tauri', 'capabilities', 'default.json'), 'utf8'),
)

describe('Linux select contrast is preserved', () => {
  it('keeps color-scheme: dark on :root, inputs, and settings selects', () => {
    assert.equal((css.match(/color-scheme:\s*dark/g) || []).length >= 3, true)
    assert.match(css, /:root[\s\S]*?color-scheme:\s*dark/)
    assert.match(css, /select option\s*\{[\s\S]*?background-color:\s*var\(--panel\)/)
    assert.match(css, /\.settings__select option\s*\{[\s\S]*?background-color:\s*var\(--panel-2\)/)
  })
})

describe('keyboard focus-visible', () => {
  it('draws a solid accent outline on keyboard focus for inputs, selects, and buttons', () => {
    assert.match(css, /input:focus-visible/)
    assert.match(css, /select:focus-visible/)
    assert.match(css, /button:focus-visible/)
    assert.match(css, /\.settings__select:focus-visible/)
    assert.match(css, /outline:\s*2px solid var\(--accent\)/)
  })
})

describe('Tauri opener capabilities', () => {
  it('does not grant opener:default (all http/https) and scopes open-url to loops.elorm.xyz', () => {
    const raw = cap.permissions
    assert.ok(!raw.includes('opener:default'))
    assert.ok(!raw.includes('opener:allow-open-url'))
    const scoped = raw.filter((p) => p && p.identifier === 'opener:allow-open-url')
    assert.equal(scoped.length, 1)
    const urls = (scoped[0].allow || []).map((a) => a.url)
    assert.ok(urls.includes('https://loops.elorm.xyz'))
    assert.ok(urls.includes('https://loops.elorm.xyz/*'))
    assert.ok(urls.every((u) => u === 'https://loops.elorm.xyz' || u.startsWith('https://loops.elorm.xyz/')))
  })

  it('keeps clipboard and global-shortcut permissions the command bar needs', () => {
    assert.ok(cap.permissions.includes('clipboard-manager:allow-write-text'))
    assert.ok(cap.permissions.includes('global-shortcut:allow-register'))
  })
})
