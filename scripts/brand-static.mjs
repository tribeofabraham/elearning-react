// After vite build: fills the brand into the plain-HTML pages in public/ (the showcase, the embed demo),
// which Vite copies as they are. Each %TOKEN% is replaced from the build's mode (.env.<mode>, e.g.
// studios), falling back to the Tribe of Abraham values below, so the default build is unchanged.
//   node scripts/brand-static.mjs [mode]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from 'vite'

const mode = process.argv[2] || 'production'
const env = loadEnv(mode, process.cwd(), 'VITE_')
const TOA = {
  BRAND: 'toa',
  BRAND_NAME: 'Tribe of Abraham',
  APP_NAME: 'E-Learning',
  SITE: 'https://learn.tribeofabraham.com',
  CMI5_URL: 'https://learn.tribeofabraham.com/cmi5/',
  OG_IMAGE: 'https://learn.tribeofabraham.com/showcase/og.png',
  LOGO: 'logo.svg',
  BYLINE: 'Mark Snyder',
  OUR: 'my',
  LECTORA_INVITE: 'https://app.cloud.scorm.com/sc/InvitationConfirmEmail?publicInvitationId=2563ee22-a93b-4c07-be53-68e166974f81',
  CMI5_INVITE: 'https://app.cloud.scorm.com/sc/InvitationConfirmEmail?publicInvitationId=e6cc192e-0ec6-443b-9f07-a44cb01b917c',
  // The authoring-tool course link opening in a new window (on: the Studios copy, whose course is the
  // Tribe of Abraham one), said in the link so it's no surprise
  LECTORA_NEW_WINDOW: '',
  LECTORA_NEW_WINDOW_NOTE: '',
  FOOTER: 'Built by Mark Snyder · <a href="https://tribeofabraham.com/samples/">Portfolio<span class="visually-hidden"> of Mark Snyder’s work</span></a> · <a href="https://linkedin.com/in/mark-snyder-792798284">LinkedIn<span class="visually-hidden"> profile of Mark Snyder</span></a>',
}
const value = (k) => (`VITE_${k}` in env ? env[`VITE_${k}`] : TOA[k])
const tokens = Object.fromEntries(Object.keys(TOA).map((k) => [k, value(k)]))
if (tokens.LECTORA_NEW_WINDOW === 'on') {
  tokens.LECTORA_NEW_WINDOW = ' target="_blank" rel="noopener"'
  tokens.LECTORA_NEW_WINDOW_NOTE = ' (opens in a new window)'
}
tokens.SITE_HOST = tokens.SITE.replace(/^https?:\/\//, '')
tokens.CMI5_HOST_PATH = tokens.CMI5_URL.replace(/^https?:\/\//, '')

const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]))
let count = 0
for (const f of files('dist').filter((f) => f.endsWith('.html'))) {
  const before = readFileSync(f, 'utf8')
  // An invitation left empty: the link becomes a note, so nothing points at a course that isn't there
  let after = before.replace(/<a([^>]*) href="%(LECTORA|CMI5)_INVITE%"[^>]*>[\s\S]*?<\/a>/g, (m, _attrs, which) =>
    tokens[`${which}_INVITE`] ? m : '<span class="on-request">A live launch in SCORM Cloud is available on request.</span>')
  after = after.replace(/%(?:VITE_)?([A-Z0-9_]+)%/g, (m, k) => (k in tokens ? tokens[k] : m))
  if (after !== before) { writeFileSync(f, after); count++ }
}
console.log(`brand-static (${mode}): ${tokens.BRAND_NAME} in ${count} page(s)`)
