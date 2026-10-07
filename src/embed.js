// When the quiz sits in an iframe on someone else's page, it talks with that page.
//
// To the page (window.parent.postMessage; nothing private, so any page may embed it: '*'):
//
//   { source: 'elearning-react', type: 'ready' }                               it can take the learner now
//   { source: 'elearning-react', type: 'resize',   height }                    its full height, as it changes
//   { source: 'elearning-react', type: 'started',  quizId }
//   { source: 'elearning-react', type: 'answered', quizId, questionId, correct }
//   { source: 'elearning-react', type: 'finished', quizId, score: { raw, max, scaled }, passed }
//
// From the page (only from the page embedding it), before the quiz is started:
//
//   { source: 'elearning-host', type: 'learner', name, id, homePage }
//
// name: as the LMS has it ("Last, First" is turned round); id: their LMS id; homePage: the LMS's
// address, so the id is recorded as that LMS's account (or email in place of id). Any may be empty.
// With an id, the quiz doesn't ask who's taking it; with only a name, it fills in the name. All of
// it is treated as unverified input (launch.js learnerFrom). Sent as a message, the learner stays out of addresses
// and server logs. The page can send it on 'ready' and/or straight away; either order works.

const embedded = window.parent !== window

export function tellHost(type, data = {}) {
  if (embedded) window.parent.postMessage({ source: 'elearning-react', type, ...data }, '*')
}

// The quiz's full height, though its content scrolls inside a fixed frame: the page around the
// scrolling area plus everything in it. content: the element holding the screens.
export function reportHeight(page, scroller, content) {
  if (!embedded || typeof ResizeObserver === 'undefined') return () => {}
  let last = 0
  const measure = () => {
    const height = Math.ceil(page.offsetHeight - scroller.clientHeight + scroller.scrollHeight)
    if (height !== last) tellHost('resize', { height: (last = height) })
  }
  const observer = new ResizeObserver(measure)
  for (const el of [page, scroller, content]) observer.observe(el)
  return () => observer.disconnect()
}

// Hears the learner from the page embedding it, then says it's ready for it. onLearner gets
// { name, id, email } as sent.
export function listenForLearner(onLearner) {
  if (!embedded) return () => {}
  const listen = (e) => {
    const d = e.data
    if (e.source !== window.parent || !d || d.source !== 'elearning-host' || d.type !== 'learner') return
    onLearner({ name: d.name, id: d.id, email: d.email, homePage: d.homePage })
  }
  window.addEventListener('message', listen)
  tellHost('ready')
  return () => window.removeEventListener('message', listen)
}
