// npm test: the showcase pages' colours meet WCAG AA. Text 4.5:1; edges and boundaries 3:1.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const css = readFileSync(new URL('../public/showcase/showcase.css', import.meta.url), 'utf8')
const token = (name) => css.match(new RegExp(String.raw`--${name}:\s*(#[0-9a-f]{6})`, 'i'))[1]
const [BG, SURFACE, FEATURE, EDGE, PAPER, CREAM, MUTED, BRASS, BRASS_LIGHT, FOCUS] =
  ['bg', 'surface', 'feature', 'edge', 'paper', 'cream', 'muted', 'brass', 'brass-light', 'focus'].map(token)
const check = (fg, bg, min) => assert.ok(contrast(fg, bg) >= min, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)} < ${min}`)

test('text reads at 4.5:1 on the page, the panels and the featured panel', () => {
  for (const fg of [PAPER, CREAM, MUTED, BRASS_LIGHT]) for (const bg of [BG, SURFACE, FEATURE]) check(fg, bg, 4.5)
})

test('black on the brass button and number badges, normal and hovered', () => {
  check('#000000', BRASS, 4.5)
  check('#000000', BRASS_LIGHT, 4.5)
  check('#000000', PAPER, 4.5)   // the skip link
})

test('panel edges, the frame border and the focus ring show at 3:1', () => {
  for (const edge of [EDGE, BRASS, FOCUS]) for (const bg of [BG, SURFACE, FEATURE]) check(edge, bg, 3)
})

test('the stand-in host site (light): text 4.5:1, its edges 3:1', () => {
  const [H_BG, H_PANEL, H_TEXT, H_MUTED, H_LINK, H_EDGE, H_NOTE, H_NOTE_EDGE] =
    ['h-bg', 'h-panel', 'h-text', 'h-muted', 'h-link', 'h-edge', 'h-note', 'h-note-edge'].map(token)
  for (const fg of [H_TEXT, H_MUTED, H_LINK]) for (const bg of [H_BG, H_PANEL, H_NOTE]) check(fg, bg, 4.5)
  for (const edge of [H_EDGE, H_NOTE_EDGE, '#000000']) for (const bg of [H_BG, H_PANEL]) check(edge, bg, 3)
})
