import assert from 'node:assert/strict'
import { test } from 'node:test'
import midiBasics from './quizzes/midi-basics.js'
import { displayName, homePageOrigin, isoDuration, learnerActor, statementsFor } from './xapi.js'

let n = 0
const opts = { newId: () => `id-${++n}`, now: '2026-10-07T12:00:00.000Z' }
const attempt = {
  quiz: midiBasics,
  actor: { objectType: 'Agent', mbox: 'mailto:learner@example.com' },
  registration: '11111111-2222-4333-8444-555555555555',
  activityId: 'https://example.com/xapi/midi-basics',
  platform: 'elearning-react',
}

test('durations are ISO 8601', () => {
  assert.equal(isoDuration(0), 'PT0S')
  assert.equal(isoDuration(83400), 'PT1M23.4S')
  assert.equal(isoDuration(3_723_000), 'PT1H2M3S')
  assert.equal(isoDuration(120_000), 'PT2M')
})

test('initialized: the quiz as an assessment, under the registration', () => {
  const [s] = statementsFor(attempt, { type: 'initialized' }, opts)
  assert.equal(s.verb.id, 'http://adlnet.gov/expapi/verbs/initialized')
  assert.equal(s.object.id, attempt.activityId)
  assert.equal(s.object.definition.type, 'http://adlnet.gov/expapi/activities/assessment')
  assert.equal(s.context.registration, attempt.registration)
  assert.equal(s.context.contextActivities, undefined)
})

test('answered: an interaction with its choices, right answer and the result', () => {
  const [s] = statementsFor(attempt, { type: 'answered', questionId: 'channels', response: 'c', durationMs: 4200 }, opts)
  assert.equal(s.verb.id, 'http://adlnet.gov/expapi/verbs/answered')
  assert.equal(s.object.id, `${attempt.activityId}/questions/channels`)
  assert.equal(s.object.definition.interactionType, 'choice')
  assert.deepEqual(s.object.definition.correctResponsesPattern, ['c'])
  assert.equal(s.object.definition.choices.length, 4)
  assert.deepEqual(s.result, { response: 'c', success: true, duration: 'PT4.2S' })
  assert.equal(s.context.contextActivities.parent[0].id, attempt.activityId)
})

test('true-false questions record "true" / "false"', () => {
  const [s] = statementsFor(attempt, { type: 'answered', questionId: 'carries-audio', response: 'true', durationMs: 1000 }, opts)
  assert.equal(s.object.definition.interactionType, 'true-false')
  assert.deepEqual(s.object.definition.correctResponsesPattern, ['false'])
  assert.equal(s.result.success, false)
})

test('finished: passed or failed with the score, then completed', () => {
  const all = Object.fromEntries(midiBasics.questions.map((q) => [q.id, q.type === 'true-false' ? String(q.answer) : q.answer]))
  const [passed, completed] = statementsFor(attempt, { type: 'finished', responses: all, durationMs: 60000 }, opts)
  assert.equal(passed.verb.id, 'http://adlnet.gov/expapi/verbs/passed')
  assert.deepEqual(passed.result.score, { raw: 10, min: 0, max: 10, scaled: 1 })
  assert.equal(passed.result.success, true)
  assert.equal(completed.verb.id, 'http://adlnet.gov/expapi/verbs/completed')
  assert.equal(completed.result.duration, 'PT1M')

  const [failed] = statementsFor(attempt, { type: 'finished', responses: { channels: 'c' }, durationMs: 1000 }, opts)
  assert.equal(failed.verb.id, 'http://adlnet.gov/expapi/verbs/failed')
  assert.equal(failed.result.score.scaled, 0.1)
})

test('learners: by email, or as an anonymous account', () => {
  assert.deepEqual(learnerActor({ name: 'Ada', email: 'ada@example.com' }, 'https://x'),
    { objectType: 'Agent', name: 'Ada', mbox: 'mailto:ada@example.com' })
  assert.deepEqual(learnerActor({ anonymousId: 'abc' }, 'https://x'),
    { objectType: 'Agent', account: { homePage: 'https://x', name: 'abc' } })
  assert.deepEqual(learnerActor({ name: 'Ada', accountId: 'jsmith42' }, 'https://x'),
    { objectType: 'Agent', name: 'Ada', account: { homePage: 'https://x', name: 'jsmith42' } })
  // An LMS id under the LMS's own address
  assert.deepEqual(learnerActor({ name: 'Ada', accountId: 'jsmith42', homePage: 'https://lms.example.com' }, 'https://x'),
    { objectType: 'Agent', name: 'Ada', account: { homePage: 'https://lms.example.com', name: 'jsmith42' } })
})

test('an LMS address is reduced to its origin, and only http(s) counts', () => {
  assert.equal(homePageOrigin('https://cloud.scorm.com/content/abc?x=1'), 'https://cloud.scorm.com')
  assert.equal(homePageOrigin('javascript:alert(1)'), null)
  assert.equal(homePageOrigin('not a url'), null)
  assert.equal(homePageOrigin(''), null)
})

test('names: "Last, First" turned round, tidied', () => {
  assert.equal(displayName('Snyder, Mark'), 'Mark Snyder')
  assert.equal(displayName('  Mark   Snyder '), 'Mark Snyder')
  assert.equal(displayName('Snyder,'), 'Snyder,')
  assert.equal(displayName('a,b,c'), 'a,b,c')
  assert.equal(displayName('Ma\u0000rk'), 'Ma rk')
  assert.equal(displayName(42), '')
})
