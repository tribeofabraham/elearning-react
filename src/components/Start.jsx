import { useRef, useState } from 'react'
import { MAX_EMAIL_LENGTH, emailError, normalizeEmail } from '../../shared/email.js'
import { actorLabel } from '../launch.js'
import { anonymousId } from '../recorder.js'

// The quiz's title and what to expect, and who the attempt is recorded as: the LMS's learner when an
// LMS launched it, the learner the embedding page passed in (a Lectora course, say), or else whoever
// the learner says they are (a name and email, or anonymous).
export default function Start({ quiz, lms, learner, onStart }) {
  const emailRef = useRef(null)
  const [emailProblem, setEmailProblem] = useState('')
  const count = quiz.questions.length
  const passMark = Math.round(quiz.passingScore * 100)

  function submit(e) {
    e.preventDefault()
    if (lms) return onStart(null)
    if (learner) return onStart(learner)
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = normalizeEmail(form.get('email'))
    if (email) {
      const problem = emailError(email)
      if (problem) {
        setEmailProblem(problem)
        emailRef.current.focus()
        return
      }
      return onStart({ name, email })
    }
    onStart({ name, anonymousId: anonymousId() })
  }

  return (
    <section className="card start" aria-labelledby="quiz-title">
      <p className="eyebrow">Quiz</p>
      <h1 id="quiz-title">{quiz.title}</h1>
      <p className="lede">{quiz.description}</p>
      <ul className="facts">
        <li><strong>{count}</strong> questions</li>
        <li><strong>{passMark}%</strong> to pass</li>
        <li>Feedback after each answer</li>
      </ul>

      <form onSubmit={submit} noValidate>
        {lms || learner ? (
          <p className="who">
            Your results are recorded as <strong>{lms ? actorLabel(lms.actor) : learner.name || learner.email || learner.accountId}</strong>.
          </p>
        ) : (
          <fieldset className="learner">
            <legend>Who is taking the quiz? <span className="optional">(optional)</span></legend>
            <p className="hint" id="learner-hint">
              Your score is recorded with xAPI. Add your email to keep it under your name; leave it blank to take the quiz anonymously.
            </p>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" autoComplete="name" maxLength={100} aria-describedby="learner-hint" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" ref={emailRef} autoComplete="email" maxLength={MAX_EMAIL_LENGTH}
                     aria-invalid={emailProblem ? 'true' : undefined}
                     aria-describedby={emailProblem ? 'email-problem learner-hint' : 'learner-hint'}
                     onChange={() => emailProblem && setEmailProblem('')} />
              {emailProblem && <p className="field-error" id="email-problem">{emailProblem}</p>}
            </div>
          </fieldset>
        )}
        <button type="submit" className="primary">Start the quiz</button>
      </form>
    </section>
  )
}
