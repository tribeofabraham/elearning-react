// Sends a quiz attempt's events to an LRS, one of two ways:
//   'server'  through this app's Node server (api/statements), which builds and scores the statements
//   'lms'     straight to the LRS an LMS launched the quiz with, building the statements here
// Either way it keeps every statement sent, so the results screen can show exactly what was recorded.
import { XAPI_VERSION, learnerActor, statementsFor } from '../shared/xapi.js'

const DEFAULT_ACTIVITY_BASE = 'https://tribeofabraham.com/xapi/elearning-react'

export class RecordError extends Error {}

export function createRecorder({ quiz, lms }) {
  const sent = []
  let attempt = null

  async function post(url, init, failure) {
    let res
    try {
      res = await fetch(url, init)
    } catch {
      throw new RecordError('Could not reach the server to record your answers.')
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new RecordError(data?.error ?? `${failure} (${res.status}).`)
    return data
  }

  return {
    mode: lms ? 'lms' : 'server',

    // A fresh attempt: a new registration, unless the LMS gave one (an LMS's registration is the
    // learner's enrolment, so every attempt there shares it).
    begin(learner) {
      attempt = {
        learner,
        registration: lms?.registration ?? crypto.randomUUID(),
      }
    },

    // event: { type: 'initialized' | 'answered' | 'finished', ... } as shared/xapi.js describes.
    // Resolves to the statements recorded; rejects with a RecordError.
    async record(event) {
      let statements
      if (lms) {
        statements = statementsFor({
          quiz,
          actor: lms.actor,
          registration: attempt.registration,
          activityId: lms.activityId ?? `${DEFAULT_ACTIVITY_BASE}/${quiz.id}`,
          platform: 'elearning-react',
        }, event, { newId: () => crypto.randomUUID(), now: new Date().toISOString() })
        await post(`${lms.endpoint}statements`, {
          method: 'POST',
          headers: { Authorization: lms.auth, 'X-Experience-API-Version': XAPI_VERSION, 'Content-Type': 'application/json' },
          body: JSON.stringify(statements),
        }, 'The LRS did not accept the statements')
      } else {
        // Relative, so it resolves next to the page wherever it's hosted
        const data = await post('api/statements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizId: quiz.id, registration: attempt.registration, learner: attempt.learner, event }),
        }, 'Recording failed')
        statements = data.statements
      }
      sent.push(...statements)
      return statements
    },

    sent: () => [...sent],
  }
}

// An anonymous learner id that stays the same in this browser, so repeat attempts group together.
export function anonymousId() {
  try {
    let id = localStorage.getItem('elearning-react:anonymous-id')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('elearning-react:anonymous-id', id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// What the server mode records a learner as, for showing them before they start.
export const previewActor = (learner) => learnerActor(learner, new URL(DEFAULT_ACTIVITY_BASE).origin)
