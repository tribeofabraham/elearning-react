import assert from 'node:assert/strict'
import { test } from 'node:test'
import { learnerFrom } from './launch.js'

test('a learner from a host: email, or an LMS id', () => {
  assert.deepEqual(learnerFrom({ name: ' Ada ', email: 'Ada@Example.com' }), { name: 'Ada', email: 'ada@example.com' })
  assert.deepEqual(learnerFrom({ name: 'Ada', id: 'jsmith42' }), { name: 'Ada', accountId: 'jsmith42' })
})

test('an id that is an email address counts as one', () => {
  assert.deepEqual(learnerFrom({ name: 'Ada', id: 'ada@example.com' }), { name: 'Ada', email: 'ada@example.com' })
})

test('nothing usable: null, so the quiz asks', () => {
  assert.equal(learnerFrom({ name: 'Ada' }), null)
  assert.equal(learnerFrom({ name: 'Ada', id: 'has spaces' }), null)
  assert.equal(learnerFrom({ email: 'not-an-email' }), null)
  assert.equal(learnerFrom(undefined), null)
  assert.equal(learnerFrom({ name: 42, id: {} }), null)
})

test('from an LMS: "Last, First" turned round, the id under the LMS address', () => {
  assert.deepEqual(learnerFrom({ name: 'Snyder, Mark', id: 'msnyder', homePage: 'https://cloud.scorm.com/content/x' }),
    { name: 'Mark Snyder', accountId: 'msnyder', homePage: 'https://cloud.scorm.com' })
  // With the LMS address, an id that looks like an email is still its account id
  assert.deepEqual(learnerFrom({ name: '', id: 'mark@example.com', homePage: 'https://lms.example.com' }),
    { name: '', accountId: 'mark@example.com', homePage: 'https://lms.example.com' })
  // A bad homePage is ignored, not trusted
  assert.deepEqual(learnerFrom({ id: 'msnyder', homePage: 'javascript:alert(1)' }), { name: '', accountId: 'msnyder' })
})
