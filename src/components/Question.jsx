import { useEffect, useRef, useState } from 'react'
import { correctResponse, isCorrect } from '../../shared/quiz.js'

// One question: pick an answer, check it, read why, go on. Focus moves to the question when it
// appears and to the feedback once checked, so a screen reader reads each in turn.
export default function Question({ quiz, index, onAnswer, onNext }) {
  const question = quiz.questions[index]
  const total = quiz.questions.length
  const last = index + 1 === total
  const options = question.type === 'true-false'
    ? [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }]
    : question.choices

  const [choice, setChoice] = useState(null)
  const [checked, setChecked] = useState(false)
  const [nudge, setNudge] = useState('')
  const headingRef = useRef(null)
  const feedbackRef = useRef(null)
  const right = correctResponse(question)
  const correct = checked && isCorrect(question, choice)

  useEffect(() => { headingRef.current?.focus() }, [])
  useEffect(() => { if (checked) feedbackRef.current?.focus() }, [checked])

  function check(e) {
    e.preventDefault()
    if (checked) return onNext()
    if (!choice) {
      setNudge('Choose an answer first.')
      return
    }
    setChecked(true)
    onAnswer(question, choice, isCorrect(question, choice))
  }

  return (
    <section className="card question" aria-labelledby={`q-${question.id}`}>
      <div className="progress">
        <p>Question {index + 1} of {total}</p>
        {/* The words above say the same; this is the picture of it */}
        <div className="progress-bar" aria-hidden="true"><span style={{ width: `${((index + (checked ? 1 : 0)) / total) * 100}%` }} /></div>
      </div>

      <form onSubmit={check} noValidate>
        <fieldset disabled={checked} aria-describedby={nudge ? 'nudge' : undefined}>
          <legend>
            <h1 id={`q-${question.id}`} ref={headingRef} tabIndex={-1}>{question.prompt}</h1>
          </legend>
          <div className="choices">
            {options.map((o) => {
              const mark = checked && (o.id === right ? 'right' : o.id === choice ? 'wrong' : null)
              return (
                <label key={o.id} className={`choice${choice === o.id ? ' chosen' : ''}${mark ? ` ${mark}` : ''}`}>
                  <input type="radio" name={question.id} value={o.id} checked={choice === o.id}
                         onChange={() => { setChoice(o.id); setNudge('') }} />
                  <span className="choice-text">{o.text}</span>
                  {/* Said in words, not only shown in colour */}
                  {mark === 'right' && <span className="choice-mark">{o.id === choice ? '✓ Your answer is right' : '✓ Right answer'}</span>}
                  {mark === 'wrong' && <span className="choice-mark">✗ Your answer</span>}
                </label>
              )
            })}
          </div>
        </fieldset>
        {nudge && <p className="field-error" id="nudge" role="alert">{nudge}</p>}

        {checked && (
          <div className={`feedback ${correct ? 'is-right' : 'is-wrong'}`} ref={feedbackRef} tabIndex={-1}>
            <h2>{correct ? 'Right!' : 'Not quite.'}</h2>
            <p>{question.explanation}</p>
          </div>
        )}

        <button type="submit" className="primary">
          {!checked ? 'Check answer' : last ? 'See your results' : 'Next question'}
        </button>
      </form>
    </section>
  )
}
