// How the quiz was opened, from its address.
//
//   ?quiz=midi-basics                        which quiz (the default if left out)
//   &xapi-panel=0                            hide the xAPI viewer's button in the footer
//
// The learner, when the page embedding the quiz already knows them (an LMS course, say):
//
//   &learner_name=Ada%20Lovelace&learner_email=ada@example.com     or  &learner_id=<their LMS id>
//
// Then the quiz doesn't ask who's taking it, and records them through this app's server. A host page
// can send the same in a message instead, which keeps it out of the address (embed.js).
//
// An LMS or LRS that launches the quiz the standard xAPI way ("Tin Can launch") adds its own LRS and
// learner, and the page then sends statements there itself:
//
//   &endpoint=<LRS url>&auth=<Basic ...>&actor=<JSON agent>&registration=<uuid>&activity_id=<IRI>
//
// Without those, the quiz asks who you are and records through this app's own server.
import { emailError, normalizeEmail } from '../shared/email.js'
import { DEFAULT_QUIZ, QUIZZES } from '../shared/quizzes/index.js'
import { ACCOUNT_ID, displayName, homePageOrigin } from '../shared/xapi.js'

export function readLaunch(search = window.location.search) {
  const params = new URLSearchParams(search)
  const quiz = QUIZZES[params.get('quiz')] ?? QUIZZES[DEFAULT_QUIZ]

  const endpoint = params.get('endpoint')
  const auth = params.get('auth')
  let actor = null
  try {
    actor = JSON.parse(params.get('actor') ?? 'null')
    // Some LMSs send name and mbox as one-item arrays (the 0.9 format)
    if (actor) {
      for (const key of ['name', 'mbox', 'mbox_sha1sum', 'openid']) if (Array.isArray(actor[key])) actor[key] = actor[key][0]
      if (Array.isArray(actor.account)) actor.account = actor.account[0]
      if (actor.account?.accountServiceHomePage) {
        actor.account = { homePage: actor.account.accountServiceHomePage, name: actor.account.accountName }
      }
    }
  } catch { actor = null }

  const lms = endpoint && auth && actor
    ? {
        endpoint: endpoint.endsWith('/') ? endpoint : `${endpoint}/`,
        auth,
        actor: { objectType: 'Agent', ...actor },
        registration: params.get('registration') || null,
        activityId: params.get('activity_id') || null,
      }
    : null

  return { quiz, lms, learner: lms ? null : readLearner(params), showViewer: params.get('xapi-panel') !== '0' }
}

// The learner given in the address, if any.
const readLearner = (params) => learnerFrom({
  name: params.get('learner_name'), email: params.get('learner_email'), id: params.get('learner_id'),
})

// A learner from what a host page gave (in the address, or in a message: embed.js), as
// { name, email } or { name, accountId, homePage? }, or null. All of it is unverified input, so it's
// cleaned: the name tidied (and an LMS's "Last, First" turned round), homePage reduced to an http(s)
// origin, a bad email or id ignored (the quiz then asks, so a host can't record the wrong person by
// mistake). An id with the LMS's homePage is that LMS's account id, even if it looks like an email;
// without one, an id that's an email address counts as an email.
export function learnerFrom({ name, email, id, homePage } = {}) {
  const cleanName = displayName(name)
  const cleanId = typeof id === 'string' ? id.trim() : ''
  const home = homePageOrigin(homePage)
  const givenEmail = normalizeEmail(email)
  if (givenEmail && !emailError(givenEmail)) return { name: cleanName, email: givenEmail }
  if (cleanId && home && ACCOUNT_ID.test(cleanId)) return { name: cleanName, accountId: cleanId, homePage: home }
  const idEmail = cleanId.includes('@') ? normalizeEmail(cleanId) : ''
  if (idEmail && !emailError(idEmail)) return { name: cleanName, email: idEmail }
  if (cleanId && ACCOUNT_ID.test(cleanId)) return { name: cleanName, accountId: cleanId }
  return null
}

// A name to show for an LMS's learner.
export function actorLabel(actor) {
  return actor?.name || actor?.mbox?.replace(/^mailto:/, '') || actor?.account?.name || 'your LMS account'
}
