// When the quiz sits in an iframe on someone else's page, it tells that page what's happening, so the
// page can react to a score or size the frame to fit. Messages look like:
//
//   { source: 'elearning-react', type: 'resize',   height }                    whenever the height changes
//   { source: 'elearning-react', type: 'started',  quizId }
//   { source: 'elearning-react', type: 'answered', quizId, questionId, correct }
//   { source: 'elearning-react', type: 'finished', quizId, score: { raw, max, scaled }, passed }
//
// The embedding page listens with window.addEventListener('message', ...). Nothing private is sent,
// so any page may embed it ('*').

const embedded = window.parent !== window

export function tellHost(type, data = {}) {
  if (embedded) window.parent.postMessage({ source: 'elearning-react', type, ...data }, '*')
}

export function reportHeight(element) {
  if (!embedded || typeof ResizeObserver === 'undefined') return () => {}
  let last = 0
  const observer = new ResizeObserver(() => {
    const height = Math.ceil(element.scrollHeight)
    if (height !== last) tellHost('resize', { height: (last = height) })
  })
  observer.observe(element)
  return () => observer.disconnect()
}
