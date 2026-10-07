// How the quiz was opened, from its address.
//
//   ?quiz=midi-basics                        which quiz (the default if left out)
//   &xapi-panel=0                            hide the xAPI viewer's button in the footer
//
// The learner, when the page embedding the quiz already knows them (an LMS course in Lectora, say):
//
//   &learner_name=Ada%20Lovelace&learner_email=ada@example.com     or  &learner_id=<their LMS id>
//
// Then the quiz doesn't ask who's taking it, and records them through this app's server.
//
// An LMS or LRS that launches the quiz the standard xAPI way ("Tin Can launch") adds its own LRS and
// learner, and the page then sends statements there itself:
//
//   &endpoint=<LRS url>&auth=<Basic ...>&actor=<JSON agent>&registration=<uuid>&activity_id=<IRI>
//
// Without those, the quiz asks who you are and records through this app's own server.
import { emailError, normalizeEmail } from '../shared/email.js'
import { DEFAULT_QUIZ, QUIZZES } from '../shared/quizzes/index.js'
import { ACCOUNT_ID } from '../shared/xapi.js'

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

// The learner given in the address, if any: { name, email } or { name, accountId }. A bad email or
// id is ignored (the quiz then asks), so a typo in a course can't record someone as the wrong person.
function readLearner(params) {
  const name = (params.get('learner_name') ?? '').trim().slice(0, 100)
  const email = normalizeEmail(params.get('learner_email'))
  const id = (params.get('learner_id') ?? '').trim()
  if (email && !emailError(email)) return { name, email }
  if (id && ACCOUNT_ID.test(id)) return { name, accountId: id }
  return null
}

// A name to show for an LMS's learner.
export function actorLabel(actor) {
  return actor?.name || actor?.mbox?.replace(/^mailto:/, '') || actor?.account?.name || 'your LMS account'
}
