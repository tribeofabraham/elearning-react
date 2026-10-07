// How the quiz was opened, from its address.
//
//   ?quiz=midi-basics                        which quiz (the default if left out)
//
// An LMS or LRS that launches the quiz the standard xAPI way ("Tin Can launch") adds its own LRS and
// learner, and the page then sends statements there itself:
//
//   &endpoint=<LRS url>&auth=<Basic ...>&actor=<JSON agent>&registration=<uuid>&activity_id=<IRI>
//
// Without those, the quiz asks who you are and records through this app's own server.
import { DEFAULT_QUIZ, QUIZZES } from '../shared/quizzes/index.js'

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

  return { quiz, lms }
}

// A name to show for an LMS's learner.
export function actorLabel(actor) {
  return actor?.name || actor?.mbox?.replace(/^mailto:/, '') || actor?.account?.name || 'your LMS account'
}
