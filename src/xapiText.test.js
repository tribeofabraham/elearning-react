import assert from 'node:assert/strict'
import { test } from 'node:test'
import midiBasics from '../shared/quizzes/midi-basics.js'
import { statementsFor } from '../shared/xapi.js'
import { actorText, describeStatement, durationText } from './xapiText.js'

const attempt = {
  quiz: midiBasics,
  actor: { objectType: 'Agent', name: 'Ada', mbox: 'mailto:ada@example.com' },
  registration: '11111111-2222-4333-8444-555555555555',
  activityId: 'https://example.com/xapi/midi-basics',
  platform: 'elearning-react',
}
const opts = { newId: () => 'id', now: '2026-10-07T12:00:00.000Z' }

test('durations in words', () => {
  assert.equal(durationText('PT4.2S'), '4.2 s')
  assert.equal(durationText('PT1M23.4S'), '1 min 23.4 s')
  assert.equal(durationText('PT1H2M'), '1 h 2 min')
  assert.equal(durationText('PT0S'), '0 s')
})

test('learners by name, then email, else anonymous', () => {
  assert.equal(actorText({ name: 'Ada', mbox: 'mailto:a@x.com' }), 'Ada')
  assert.equal(actorText({ mbox: 'mailto:a@x.com' }), 'a@x.com')
  assert.equal(actorText({ account: { homePage: 'h', name: 'uuid' } }), 'An anonymous learner')
})

test('an answer: the question, the response in words, right or wrong, the time', () => {
  const [s] = statementsFor(attempt, { type: 'answered', questionId: 'sustain', response: 'a', durationMs: 4200 }, opts)
  assert.deepEqual(describeStatement(s), {
    verb: 'answered',
    actor: 'Ada',
    object: 'Control Change 64 is usually which control?',
    details: [
      { label: 'Response', value: 'Volume' },
      { label: 'Correct', value: 'No', tone: 'wrong' },
      { label: 'Time', value: '4.2 s' },
    ],
  })
})

test('true-false responses read as True / False', () => {
  const [s] = statementsFor(attempt, { type: 'answered', questionId: 'carries-audio', response: 'false', durationMs: 1000 }, opts)
  assert.equal(describeStatement(s).details[0].value, 'False')
})

test('a pass: the score and the verdict', () => {
  const all = Object.fromEntries(midiBasics.questions.map((q) => [q.id, q.type === 'true-false' ? String(q.answer) : q.answer]))
  const [passed] = statementsFor(attempt, { type: 'finished', responses: all, durationMs: 83400 }, opts)
  const d = describeStatement(passed)
  assert.equal(d.verb, 'passed')
  assert.equal(d.object, 'MIDI Basics')
  assert.deepEqual(d.details.map((x) => `${x.label}: ${x.value}`), ['Score: 10 of 10 (100%)', 'Passed: Yes', 'Completed: Yes', 'Time: 1 min 23.4 s'])
})
