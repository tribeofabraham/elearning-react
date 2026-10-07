import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import logo from './assets/LogoOnly.svg'
import { scoreAttempt } from '../shared/quiz.js'
import { reportHeight, tellHost } from './embed.js'
import { readLaunch } from './launch.js'
import { createRecorder } from './recorder.js'
import { useSizer } from './sizer.js'
import Question from './components/Question.jsx'
import Results from './components/Results.jsx'
import Start from './components/Start.jsx'
import XapiPanel from './components/XapiPanel.jsx'

// The quiz fills the space it's given (a full window, or an iframe on another page)
const SIZER = { designWidth: 900, designHeight: 820, fitHeight: true, minScale: 0.8, maxScale: 1.8, reflowBelow: 36 }

// One attempt goes: start → each question (answer, check, feedback) → results.
export default function App() {
  const { quiz, lms, showPanel } = useMemo(() => readLaunch(), [])
  const recorder = useMemo(() => createRecorder({ quiz, lms }), [quiz, lms])
  const log = useSyncExternalStore(recorder.subscribe, recorder.log)

  const [fluid, setFluid] = useState(true)
  const sizerRef = useRef(null)
  const scale = useSizer(sizerRef, { ...SIZER, enabled: fluid })
  const pageRef = useRef(null)
  useEffect(() => reportHeight(pageRef.current), [])

  const [screen, setScreen] = useState('start')   // 'start' | 'question' | 'results'
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [recordError, setRecordError] = useState('')
  const [finishState, setFinishState] = useState('idle')   // 'idle' | 'saving' | 'saved' | 'failed'
  const timing = useRef({ attempt: 0, question: 0 })

  // Recording happens alongside the quiz: a failure is reported, never in the learner's way
  const record = (event) => recorder.record(event).catch((err) => {
    setRecordError(err.message)
    throw err
  })

  function start(learner) {
    recorder.begin(learner)
    setResponses({})
    setIndex(0)
    setRecordError('')
    setFinishState('idle')
    timing.current = { attempt: Date.now(), question: Date.now() }
    setScreen('question')
    record({ type: 'initialized' }).catch(() => {})
    tellHost('started', { quizId: quiz.id })
  }

  function answer(question, response, correct) {
    setResponses((r) => ({ ...r, [question.id]: response }))
    const durationMs = Date.now() - timing.current.question
    record({ type: 'answered', questionId: question.id, response, durationMs }).catch(() => {})
    tellHost('answered', { quizId: quiz.id, questionId: question.id, correct })
  }

  function finish(all = responses) {
    setFinishState('saving')
    record({ type: 'finished', responses: all, durationMs: Date.now() - timing.current.attempt })
      .then(() => setFinishState('saved'), () => setFinishState('failed'))
    const { raw, max, scaled, passed } = scoreAttempt(quiz, all)
    tellHost('finished', { quizId: quiz.id, score: { raw, max, scaled }, passed })
  }

  function next() {
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1)
      timing.current.question = Date.now()
    } else {
      setScreen('results')
      finish()
    }
  }

  return (
    <div className="sizer" ref={sizerRef}>
      <div className={showPanel ? 'page has-panel' : 'page'} ref={pageRef} style={{ fontSize: `${scale}rem` }}>
        <header className="top">
          {/* Decorative: the name beside it says who this is */}
          <img src={logo} alt="" className="brand-star" width="864" height="864" />
          <p className="brand"><span className="brand-name">Tribe of Abraham</span> <span className="app-name">E-Learning</span></p>
        </header>

        <main className="main">
          {screen === 'start' && <Start quiz={quiz} lms={lms} onStart={start} />}
          {screen === 'question' && (
            <Question key={quiz.questions[index].id} quiz={quiz} index={index}
                      onAnswer={answer} onNext={next} />
          )}
          {screen === 'results' && (
            <Results quiz={quiz} responses={responses} finishState={finishState}
                     onRetrySave={() => finish()} onRestart={() => setScreen('start')} />
          )}
          {/* Polite: recording problems are worth knowing about, not worth interrupting for */}
          <p className="record-error" role="status">
            {recordError && screen === 'question' ? `Your answers aren't being recorded right now: ${recordError}` : ''}
          </p>
        </main>

        <footer className="foot">
          <p>© {new Date().getFullYear()} <a href="https://tribeofabraham.com">Tribe of Abraham</a> · xAPI e-learning</p>
          <button type="button" className="scale-toggle" aria-pressed={fluid} onClick={() => setFluid(!fluid)}>
            Auto-scale text
          </button>
        </footer>

        {showPanel && <XapiPanel log={log} mode={recorder.mode} />}
      </div>
    </div>
  )
}
