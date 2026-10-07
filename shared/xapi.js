// xAPI statements for a quiz attempt, shared by the server (which sends them to its LRS) and the page
// (which sends them itself when an LMS launches it with its own LRS).
//
// One attempt, under one registration (a UUID that ties its statements together):
//   initialized  the quiz              when it starts
//   answered     each question         with the response, success and time taken
//   passed/failed the quiz             with the score
//   completed    the quiz              with the total time
//
// Verbs are ADL's (http://adlnet.gov/expapi/verbs/), the ones LMSs and LRS reports understand.

import { correctResponse, isCorrect, scoreAttempt } from './quiz.js'

export const XAPI_VERSION = '1.0.3'
const LANG = 'en-US'

export const VERBS = Object.fromEntries(
  ['initialized', 'answered', 'passed', 'failed', 'completed'].map((v) => [
    v,
    { id: `http://adlnet.gov/expapi/verbs/${v}`, display: { [LANG]: v } },
  ]),
)

// Milliseconds as an ISO 8601 duration, as xAPI wants: 83400 -> "PT1M23.4S".
export function isoDuration(ms) {
  const tenths = Math.max(0, Math.round(ms / 100))
  const h = Math.floor(tenths / 36000)
  const m = Math.floor((tenths % 36000) / 600)
  const s = (tenths % 600) / 10
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || !(h || m) ? `${s}S` : ''}`
}

// The quiz as an xAPI activity. activityId: the IRI to record it under (an LMS may give its own).
export function quizActivity(quiz, activityId) {
  return {
    objectType: 'Activity',
    id: activityId,
    definition: {
      type: 'http://adlnet.gov/expapi/activities/assessment',
      name: { [LANG]: quiz.title },
      description: { [LANG]: quiz.description },
    },
  }
}

// A question as an xAPI interaction, with its choices and right answer, so an LRS can report on it.
export function questionActivity(question, activityId) {
  const definition = {
    type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
    name: { [LANG]: question.prompt },
    interactionType: question.type,
    correctResponsesPattern: [correctResponse(question)],
  }
  if (question.type === 'choice') {
    definition.choices = question.choices.map((c) => ({ id: c.id, description: { [LANG]: c.text } }))
  }
  return { objectType: 'Activity', id: `${activityId}/questions/${question.id}`, definition }
}

/**
 * The statements for one event of an attempt.
 *
 * attempt: { quiz, actor, registration, activityId, platform }
 * event:
 *   { type: 'initialized' }
 *   { type: 'answered', questionId, response, durationMs }
 *   { type: 'finished', responses: { [questionId]: response }, durationMs }  -> passed/failed + completed
 * newId: makes statement ids (crypto.randomUUID on either side).
 * now: the timestamp, as an ISO string.
 */
export function statementsFor(attempt, event, { newId, now }) {
  const { quiz, actor, registration, activityId, platform } = attempt
  const quizObject = quizActivity(quiz, activityId)
  const base = (verb, object, extra = {}) => ({
    id: newId(),
    timestamp: now,
    actor,
    verb: VERBS[verb],
    object,
    context: {
      registration,
      platform,
      language: LANG,
      ...(object === quizObject ? {} : { contextActivities: { parent: [{ objectType: 'Activity', id: activityId }] } }),
    },
    ...extra,
  })

  if (event.type === 'initialized') return [base('initialized', quizObject)]

  if (event.type === 'answered') {
    const question = quiz.questions.find((q) => q.id === event.questionId)
    return [base('answered', questionActivity(question, activityId), {
      result: {
        response: event.response,
        success: isCorrect(question, event.response),
        duration: isoDuration(event.durationMs),
      },
    })]
  }

  if (event.type === 'finished') {
    const { raw, min, max, scaled, passed } = scoreAttempt(quiz, event.responses)
    const duration = isoDuration(event.durationMs)
    return [
      base(passed ? 'passed' : 'failed', quizObject, {
        result: { score: { raw, min, max, scaled }, success: passed, completion: true, duration },
      }),
      base('completed', quizObject, { result: { completion: true, duration } }),
    ]
  }

  throw new Error(`Unknown event type: ${event.type}`)
}

// An actor for a learner: their email if there is one; else an account, named by the id their LMS
// gave (accountId) or an anonymous id. An LMS id belongs to that LMS, so its account's homePage is
// the LMS's (learner.homePage) when known; otherwise, and for anonymous ids, defaultHome (this site).
export function learnerActor({ name, email, accountId, anonymousId, homePage }, defaultHome) {
  const actor = { objectType: 'Agent' }
  if (name) actor.name = name
  if (email) actor.mbox = `mailto:${email}`
  else actor.account = { homePage: (accountId && homePage) || defaultHome, name: accountId ?? anonymousId }
  return actor
}

// The origin of a web address (https://lms.example.com), or null if it isn't an http(s) one.
export function homePageOrigin(value) {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch { return null }
}

// A learner's name as it's shown and recorded: control characters gone, spaces tidied, at most 100
// characters, and an LMS's "Last, First" turned round to "First Last".
export function displayName(value) {
  if (typeof value !== 'string') return ''
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
  const parts = name.split(',')
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) return `${parts[1].trim()} ${parts[0].trim()}`
  return name
}

// An LMS's learner id: letters, digits and . _ @ : + - only, so it's safe in an IRI and a log.
export const ACCOUNT_ID = /^[\w.@:+-]{1,100}$/
