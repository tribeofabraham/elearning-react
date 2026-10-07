// Sends a quiz attempt's events to an LRS, one of two ways:
//   'server'  through this app's Node server (api/statements), which builds and scores the statements
//   'lms'     straight to the LRS an LMS launched the quiz with, building the statements here
// Either way it keeps a log of every event (sending, stored or failed, with its statements), which the
// xAPI panel shows live: subscribe(fn) to hear of changes, log() for the current list.
import { XAPI_VERSION, learnerActor, statementsFor } from '../shared/xapi.js'

const DEFAULT_ACTIVITY_BASE = 'https://tribeofabraham.com/xapi/elearning-react'

export class RecordError extends Error {}

export function createRecorder({ quiz, lms }) {
  let attempt = null
  let log = []          // [{ id, event, status: 'sending' | 'stored' | 'failed', statements, error, at }]
  let nextId = 1
  const listeners = new Set()
  const update = (id, change) => {
    log = log.map((e) => (e.id === id ? { ...e, ...change } : e))
    listeners.forEach((fn) => fn())
  }
  const add = (entry) => {
    log = [...log, entry]
    listeners.forEach((fn) => fn())
  }

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
      const id = nextId++
      add({ id, event: event.type, status: 'sending', statements: [], error: '', at: Date.now() })
      try {
        const statements = await send(event, (built) => update(id, { statements: built }))
        update(id, { status: 'stored', statements })
        return statements
      } catch (err) {
        update(id, { status: 'failed', error: err.message })
        throw err
      }
    },

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    log: () => log,
  }

  // Sends one event; built(statements) is called as soon as the statements are known (before sending,
  // when they're made here).
  async function send(event, built) {
    let statements
    if (lms) {
      statements = statementsFor({
        quiz,
        actor: lms.actor,
        registration: attempt.registration,
        activityId: lms.activityId ?? `${DEFAULT_ACTIVITY_BASE}/${quiz.id}`,
        platform: 'elearning-react',
      }, event, { newId: () => crypto.randomUUID(), now: new Date().toISOString() })
      built(statements)
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
    return statements
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
