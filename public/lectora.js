/*
 * For the page around the quiz in a Lectora course (or any SCORM course). One line, in an HTML
 * Extension on the page that has the quiz's Web Window:
 *
 *   <script src="https://learn.tribeofabraham.com/lectora.js"></script>
 *
 * 1. Tells the quiz who the learner is, from Lectora's AICC_Student_Name and AICC_Student_ID, so it
 *    doesn't ask. By message ({ source: 'elearning-host', type: 'learner', name, id }), answering
 *    the quiz's 'ready', so the learner stays out of addresses and server logs.
 * 2. When the quiz is finished, puts the score into the course's SCORM record:
 *    - in Lectora, through its own variables (AICC_Score as a percentage, AICC_Lesson_Status passed
 *      or failed), so Lectora reports them to the LMS itself;
 *    - otherwise straight to the LMS's SCORM API, 2004 (API_1484_11) or 1.2 (API).
 *
 * Options, as attributes on the script tag:
 *   data-status="off"   set the score only, not passed / failed
 *   data-debug="on"     log what it does in the browser console
 *
 * It only listens to messages from the quiz's own address. The quiz can't do this itself: in the
 * course it's in a frame from another site, which browsers keep out of the course's SCORM.
 */
(function () {
  'use strict'
  var me = document.currentScript
  var QUIZ = new URL(me.src).origin
  var setStatus = me.getAttribute('data-status') !== 'off'
  var debug = me.getAttribute('data-debug') === 'on'
  var log = function () { if (debug && window.console) console.log.apply(console, ['[elearning-react]'].concat([].slice.call(arguments))) }

  // A Lectora variable, if this is a Lectora page and it has it. Lectora makes them page globals:
  // its own reserved ones under their names (AICC_Score), the course's own as Var<name> (VarQuizScore).
  function lectoraVar(name) {
    var names = [name, 'Var' + name]
    for (var i = 0; i < names.length; i++) {
      try {
        var v = window[names[i]]
        if (v && typeof v.getValue === 'function' && typeof v.set === 'function') return v
      } catch (e) { /* not here */ }
    }
    return null
  }
  function value(name) {
    var v = lectoraVar(name)
    try { return v ? String(v.getValue() || '').trim() : '' } catch (e) { return '' }
  }

  // The LMS's SCORM API: in this window or one of its parents (or their openers), as the standard says
  function findApi(names) {
    var w = window
    for (var hops = 0; w && hops < 20; hops++) {
      for (var i = 0; i < names.length; i++) {
        try { if (w[names[i]]) return { name: names[i], api: w[names[i]] } } catch (e) { /* another site's frame */ }
      }
      if (w.parent && w.parent !== w) w = w.parent
      else { try { w = w.opener } catch (e) { w = null } }
    }
    return null
  }

  // -- 1. The learner, by message (kept out of addresses and server logs) --
  // The quiz says 'ready' when it can take it; it's also sent straight away, in case it was ready first.
  function sendLearner() {
    var name = value('AICC_Student_Name')
    var id = value('AICC_Student_ID')
    if (!name && !id) return
    var frames = document.querySelectorAll('iframe')
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i]
      if (!f.src || f.src.indexOf(QUIZ) !== 0 || !f.contentWindow) continue
      f.contentWindow.postMessage({ source: 'elearning-host', type: 'learner', name: name, id: id }, QUIZ)
      log('learner sent', name, id)
    }
  }
  if (document.readyState === 'complete') sendLearner()
  else window.addEventListener('load', sendLearner)

  // -- 2. The score, into SCORM --
  function report(score, passed) {
    var percent = Math.round(score.scaled * 100)

    // Lectora sends these to the LMS as they're set: AICC_Score as the score (SCORM 2004: raw, and
    // scaled = score / 100), AICC_Lesson_Status as passed / failed (2004: cmi.success_status; 1.2:
    // cmi.core.lesson_status), CMI_Completion_Status (2004) as completed.
    var lectoraScore = lectoraVar('AICC_Score')
    if (lectoraScore) {
      lectoraScore.set(String(percent))
      var said = ['AICC_Score = ' + percent]
      if (setStatus) {
        var status = lectoraVar('AICC_Lesson_Status')
        if (status) { status.set(passed ? 'passed' : 'failed'); said.push('AICC_Lesson_Status = ' + (passed ? 'passed' : 'failed')) }
        var completion = lectoraVar('CMI_Completion_Status')
        if (completion) { completion.set('completed'); said.push('CMI_Completion_Status = completed') }
      }
      log('Lectora:', said.join(' / '))
      return 'lectora'
    }

    var found = findApi(['API_1484_11', 'API'])
    if (!found) { log('no Lectora variables and no SCORM API found: score not reported'); return 'none' }
    var api = found.api
    if (found.name === 'API_1484_11') {   // SCORM 2004
      api.SetValue('cmi.score.scaled', String(score.scaled))
      api.SetValue('cmi.score.raw', String(score.raw))
      api.SetValue('cmi.score.min', '0')
      api.SetValue('cmi.score.max', String(score.max))
      if (setStatus) {
        api.SetValue('cmi.success_status', passed ? 'passed' : 'failed')
        api.SetValue('cmi.completion_status', 'completed')
      }
      api.Commit('')
    } else {                               // SCORM 1.2: scores are 0-100
      api.LMSSetValue('cmi.core.score.raw', String(percent))
      api.LMSSetValue('cmi.core.score.min', '0')
      api.LMSSetValue('cmi.core.score.max', '100')
      if (setStatus) api.LMSSetValue('cmi.core.lesson_status', passed ? 'passed' : 'failed')
      api.LMSCommit('')
    }
    log('SCORM ' + (found.name === 'API' ? '1.2' : '2004') + ':', percent + '%', passed ? 'passed' : 'failed')
    return found.name
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== QUIZ) return
    var d = e.data
    if (d && d.source === 'elearning-react' && d.type === 'ready') return sendLearner()
    if (!d || d.source !== 'elearning-react' || d.type !== 'finished' || !d.score) return
    try {
      var how = report(d.score, !!d.passed)
      window.dispatchEvent(new CustomEvent('elearning-react:reported', { detail: { how: how, score: d.score, passed: d.passed } }))
    } catch (err) {
      log('could not report the score:', err)
    }
  })
})()
