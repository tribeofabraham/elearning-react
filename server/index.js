// The e-learning server: serves the built quiz and records attempts in an LRS.
//
// The page sends only what happened (this quiz, this answer, this long). The statements are built
// and scored here, with the same code the page uses, so the LRS credentials never reach the
// browser and the browser can't post a made-up score or any other statement.
//
//   browser ──POST api/statements { quizId, registration, learner, event }──▶ this server ──▶ LRS
//
// (When an LMS launches the quiz with its own LRS in the address, the page sends statements to that
// LRS itself and this server only serves the page.)
import express from 'express'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { emailError, normalizeEmail } from '../shared/email.js'
import { isValidResponse, quizProblems, scoreAttempt } from '../shared/quiz.js'
import { QUIZZES } from '../shared/quizzes/index.js'
import { ACCOUNT_ID, XAPI_VERSION, learnerActor, statementsFor } from '../shared/xapi.js'

const {
  LRS_ENDPOINT,
  LRS_KEY,
  LRS_SECRET,
  // Activities are recorded as <ACTIVITY_BASE>/<quiz id>
  ACTIVITY_BASE = 'https://tribeofabraham.com/xapi/elearning-react',
  PORT = 3030,
  // On the VPS: 127.0.0.1, so only Caddy (in front) can reach it. Left unset in development.
  HOST,
} = process.env

for (const quiz of Object.values(QUIZZES)) {
  const problems = quizProblems(quiz)
  if (problems.length) {
    console.error(`Quiz ${quiz.id} has problems:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
}

// With no credentials, statements are printed instead of sent. Development only: a live server must
// never drop a learner's results silently.
const useMockLrs = !LRS_ENDPOINT || !LRS_KEY || !LRS_SECRET
if (useMockLrs && process.env.NODE_ENV === 'production') {
  console.error('LRS_ENDPOINT, LRS_KEY and LRS_SECRET must be set in production.')
  process.exit(1)
}
const endpoint = LRS_ENDPOINT?.endsWith('/') ? LRS_ENDPOINT : `${LRS_ENDPOINT}/`
const lrsHeaders = {
  Authorization: 'Basic ' + Buffer.from(`${LRS_KEY}:${LRS_SECRET}`).toString('base64'),
  'X-Experience-API-Version': XAPI_VERSION,
  'Content-Type': 'application/json',
}
const anonymousHome = new URL(ACTIVITY_BASE).origin

async function sendToLrs(statements) {
  if (useMockLrs) {
    console.log('[mock LRS]\n' + JSON.stringify(statements, null, 2))
    return
  }
  const res = await fetch(endpoint + 'statements', { method: 'POST', headers: lrsHeaders, body: JSON.stringify(statements) })
  if (!res.ok) throw new Error(`LRS responded ${res.status}: ${await res.text()}`)
  console.log(`LRS ${res.status}: ${statements.map((s) => s.verb.display['en-US']).join(', ')}`)
}

// -- checking what the page sends --

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_NAME = 100
const MAX_DURATION = 24 * 60 * 60 * 1000

class BadRequest extends Error {}

function readLearner(learner) {
  const name = typeof learner?.name === 'string' ? learner.name.trim().slice(0, MAX_NAME) : ''
  const email = normalizeEmail(learner?.email)
  if (email) {
    const error = emailError(email)
    if (error) throw new BadRequest(error)
    return { name, email }
  }
  // An id from the learner's LMS (e.g. passed in by a Lectora course)
  if (learner?.accountId !== undefined) {
    if (!ACCOUNT_ID.test(learner.accountId)) throw new BadRequest('That learner id has characters it may not.')
    return { name, accountId: learner.accountId }
  }
  if (!UUID.test(learner?.anonymousId ?? '')) throw new BadRequest('An email address or an anonymous id is needed.')
  return { name, anonymousId: learner.anonymousId.toLowerCase() }
}

const readDuration = (ms) => (Number.isFinite(ms) ? Math.min(Math.max(0, ms), MAX_DURATION) : 0)

function readEvent(quiz, event) {
  if (event?.type === 'initialized') return { type: 'initialized' }
  if (event?.type === 'answered') {
    const question = quiz.questions.find((q) => q.id === event.questionId)
    if (!question || !isValidResponse(question, event.response)) throw new BadRequest('That answer is not one this question offers.')
    return { type: 'answered', questionId: question.id, response: event.response, durationMs: readDuration(event.durationMs) }
  }
  if (event?.type === 'finished') {
    // Only real answers to real questions count; anything else is ignored (and so scores as wrong)
    const responses = {}
    for (const q of quiz.questions) {
      const r = event.responses?.[q.id]
      if (isValidResponse(q, r)) responses[q.id] = r
    }
    return { type: 'finished', responses, durationMs: readDuration(event.durationMs) }
  }
  throw new BadRequest('Unknown event.')
}

// -- the app --

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, lrs: useMockLrs ? 'mock' : 'configured' }))

app.post('/api/statements', async (req, res) => {
  let statements
  let score
  try {
    const quiz = QUIZZES[req.body?.quizId]
    if (!quiz) throw new BadRequest('Unknown quiz.')
    if (!UUID.test(req.body?.registration ?? '')) throw new BadRequest('A registration id is needed.')
    const event = readEvent(quiz, req.body.event)
    const attempt = {
      quiz,
      actor: learnerActor(readLearner(req.body.learner), anonymousHome),
      registration: req.body.registration.toLowerCase(),
      activityId: `${ACTIVITY_BASE}/${quiz.id}`,
      platform: 'elearning-react',
    }
    statements = statementsFor(attempt, event, { newId: randomUUID, now: new Date().toISOString() })
    if (event.type === 'finished') score = scoreAttempt(quiz, event.responses)
  } catch (err) {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message })
    throw err
  }

  try {
    await sendToLrs(statements)
    res.json({ statements, score })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Your answers could not be recorded just now.' })
  }
})

// In production this one server also serves the built quiz (npm run build → dist/), so the page and
// api/ share an address. Framing is allowed on purpose: the quiz is made to be embedded anywhere.
const distDir = fileURLToPath(new URL('../dist', import.meta.url))
if (existsSync(distDir)) app.use(express.static(distDir))

const onListening = (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Is the server already running?` : err)
    process.exit(1)
  }
  console.log(`E-learning server on http://${HOST ?? 'localhost'}:${PORT}`)
  if (existsSync(distDir)) console.log(`Serving the built quiz from ${distDir}`)
  console.log(useMockLrs ? 'No LRS credentials: using the mock LRS (statements are printed here)' : `LRS: ${endpoint}`)
}
if (HOST) app.listen(PORT, HOST, onListening)
else app.listen(PORT, onListening)
