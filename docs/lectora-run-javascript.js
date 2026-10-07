// For the Lectora page's On Show "Run JavaScript" action (replaces the old score listener).
// Sends the quiz the learner, and when it's finished sets Lectora's SCORM variables: score,
// passed/failed and completed. Lectora's reserved variables are page globals under their own names
// (AICC_Score, ...); its course variables are Var<name> (VarquizScore).
if (!window.quizBridge) {
  window.quizBridge = true
  var QUIZ = 'https://learn.tribeofabraham.com'
  var has = function (v) { return typeof v !== 'undefined' && v && typeof v.set === 'function' }
  var read = function (v) { try { return has(v) ? String(v.getValue() || '') : '' } catch (e) { return '' } }

  var quizFrame = function () {
    var frames = document.querySelectorAll('iframe')
    for (var i = 0; i < frames.length; i++) if ((frames[i].src || '').indexOf(QUIZ) === 0) return frames[i]
    return null
  }
  // The learner, to the quiz only (its origin), so it doesn't ask "Who is taking the quiz?"
  var sendLearner = function () {
    var f = quizFrame()
    if (!f || !f.contentWindow) return
    f.contentWindow.postMessage({
      source: 'elearning-host', type: 'learner',
      name: read(typeof AICC_Student_Name !== 'undefined' ? AICC_Student_Name : undefined),
      id: read(typeof AICC_Student_ID !== 'undefined' ? AICC_Student_ID : undefined),
      homePage: window.location.origin,   // the LMS serving the course: the id is its account
    }, QUIZ)
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== QUIZ) return
    var d = e.data
    if (!d || d.source !== 'elearning-react') return
    if (d.type === 'ready') { sendLearner(); return }
    if (d.type !== 'finished' || !d.score) return
    var pct = Math.round(Number(d.score.scaled) * 100)
    if (isNaN(pct)) return
    if (typeof VarquizScore !== 'undefined' && has(VarquizScore)) VarquizScore.set(pct)
    // Lectora sends these to the LMS as they're set (SCORM 2004: cmi.score.raw / .scaled,
    // cmi.success_status, cmi.completion_status)
    if (typeof AICC_Score !== 'undefined' && has(AICC_Score)) AICC_Score.set(String(pct))
    if (typeof AICC_Lesson_Status !== 'undefined' && has(AICC_Lesson_Status)) AICC_Lesson_Status.set(d.passed ? 'passed' : 'failed')
    if (typeof CMI_Completion_Status !== 'undefined' && has(CMI_Completion_Status)) CMI_Completion_Status.set('completed')
  })
  sendLearner()   // in case the quiz was ready before this ran
}
