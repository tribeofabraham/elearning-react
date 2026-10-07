import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import logo from './assets/LogoOnly.svg'
import { scoreAttempt } from '../shared/quiz.js'
import { listenForLearner, reportHeight, tellHost } from './embed.js'
import { learnerFrom, readLaunch } from './launch.js'
import { displayName } from '../shared/xapi.js'
import { createRecorder } from './recorder.js'
import { useSizer } from './sizer.js'
import Question from './components/Question.jsx'
import Results from './components/Results.jsx'
import Start from './components/Start.jsx'
import XapiViewer from './components/XapiViewer.jsx'

// The quiz fills the space it's given (a full window, or an iframe on another page). A wide, short
// space (a course's web window, a phone on its side) gets the landscape layout: two columns and a slim
// top bar (index.css), so it's sized to a shorter design. LANDSCAPE is the same test as the CSS's.
const SIZER = { designWidth: 900, designHeight: 820, fitHeight: true, minScale: 0.8, maxScale: 1.8, reflowBelow: 36 }
const LANDSCAPE_SIZER = { designWidth: 860, designHeight: 470, fitHeight: true, minScale: 0.8, maxScale: 1.8, reflowBelow: 30 }
const LANDSCAPE = '(min-aspect-ratio: 3/2) and (max-height: 600px)'

function useLandscape() {
  const query = useMemo(() => window.matchMedia(LANDSCAPE), [])
  return useSyncExternalStore(
    (onChange) => { query.addEventListener('change', onChange); return () => query.removeEventListener('change', onChange) },
    () => query.matches,
  )
}

// One attempt goes: start → each question (answer, check, feedback) → results.
export default function App() {
  const { quiz, lms, learner: givenLearner, showViewer } = useMemo(() => readLaunch(), [])
  const recorder = useMemo(() => createRecorder({ quiz, lms }), [quiz, lms])
  const log = useSyncExternalStore(recorder.subscribe, recorder.log)

  const [fluid, setFluid] = useState(true)
  const sizerRef = useRef(null)
  const landscape = useLandscape()
  const scale = useSizer(sizerRef, { ...(landscape ? LANDSCAPE_SIZER : SIZER), enabled: fluid })
  const pageRef = useRef(null)
  const mainRef = useRef(null)
  const contentRef = useRef(null)
  useEffect(() => reportHeight(pageRef.current, mainRef.current, contentRef.current), [])

  const [screen, setScreen] = useState('start')   // 'start' | 'question' | 'results'
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [recordError, setRecordError] = useState('')
  const [finishState, setFinishState] = useState('idle')   // 'idle' | 'saving' | 'saved' | 'failed'
  const timing = useRef({ attempt: 0, question: 0 })

  // The learner, if the address or the page embedding the quiz says who it is (until the quiz starts;
  // an LMS launch has its own)
  const [learner, setLearner] = useState(givenLearner)
  const [knownName, setKnownName] = useState('')   // a name alone: filled in, the learner can change it
  const started = useRef(false)
  useEffect(() => {
    if (lms) return undefined
    return listenForLearner((sent) => {
      if (started.current) return
      const found = learnerFrom(sent)
      if (found) setLearner(found)
      else setKnownName(displayName(sent.name))
    })
  }, [lms])

  // Recording happens alongside the quiz: a failure is reported, never in the learner's way
  const record = (event) => recorder.record(event).catch((err) => {
    setRecordError(err.message)
    throw err
  })

  function start(who) {
    started.current = true
    recorder.begin(who)
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
      <div className="page" ref={pageRef} style={{ fontSize: `${scale}rem` }}>
        <header className="top">
          {/* Decorative: the name beside it says who this is */}
          <img src={logo} alt="" className="brand-star" width="864" height="864" />
          <p className="brand"><span className="brand-name">Tribe of Abraham</span> <span className="app-name">E-Learning</span></p>
        </header>

        {/* The quiz scrolls here, between a fixed top and bottom, so it works in a frame of any size,
            even one that can't scroll itself (a course's web window) */}
        <main className="main" ref={mainRef}>
          <div className="main-content" ref={contentRef}>
            {screen === 'start' && <Start quiz={quiz} lms={lms} learner={learner} knownName={knownName} onStart={start} />}
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
          </div>
        </main>

        <footer className="foot">
          <p>© {new Date().getFullYear()} <a href="https://tribeofabraham.com">Tribe of Abraham</a> · xAPI e-learning</p>
          <div className="foot-tools">
            {showViewer && <XapiViewer log={log} mode={recorder.mode} />}
          {/* A switch: its name stays "Auto-scale text" and it reports on / off itself, so the
              visible On / Off is for the eye only (screen readers would otherwise hear it twice) */}
          <button type="button" role="switch" aria-checked={fluid} className="scale-switch" onClick={() => setFluid(!fluid)}>
            Auto-scale text
            <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
            <span className="switch-state" aria-hidden="true">{fluid ? 'On' : 'Off'}</span>
          </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
