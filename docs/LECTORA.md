# Using the quiz in a Lectora course

The quiz runs at an address (https://learn.tribeofabraham.com), so in Lectora it goes in a **Web
Window** (web object) like any web page. It sizes itself to the window, records each attempt with
xAPI in the quiz's own LRS (SCORM Cloud), and tells the course page its score.

> The quiz and `lectora.js` are tested against stand-ins for a Lectora page and for SCORM 1.2 and
> 2004 LMSs. The Lectora side (menu names, its variables reaching the LMS) is written from how
> Lectora generally works, not tried in Lectora itself: test in a course on SCORM Cloud first.

## 1. Just the quiz

Add a Web Window to the page and set its address to:

```
https://learn.tribeofabraham.com/?quiz=midi-basics&xapi-panel=0
```

- Give it room: about 900 × 700 or more. The quiz scales to fit, and scrolls inside the window on
  the results page.
- `xapi-panel=0` hides the small "{ } xAPI" button in the quiz's footer, which is there for demos.
  Leave it off to show the statements as they're sent.
- The quiz asks who's taking it (a name and email, or anonymous), unless step 2 passes that in.

## 2. The learner in, the score out: one line

On the same page as the Web Window, add an **HTML Extension** (the kind that holds HTML/JavaScript)
with just:

```html
<script src="https://learn.tribeofabraham.com/lectora.js"></script>
```

That script, served by the quiz:

1. **Tells the quiz who the learner is**, from Lectora's `AICC_Student_Name` and `AICC_Student_ID`,
   so the quiz doesn't ask. (An id that's an email address is recorded as one.)
2. **Puts the score into the course's SCORM record** when the quiz is finished:
   - in Lectora, by setting `AICC_Score` (the percentage) and `AICC_Lesson_Status` (`passed` or
     `failed`), which Lectora reports to the LMS itself, alongside everything else it reports;
   - on a page that isn't Lectora's, straight to the LMS's SCORM API (2004 or 1.2).

Options on the script tag:

| | |
| --- | --- |
| `data-status="off"` | Set the score only, not passed / failed (if the course decides those itself) |
| `data-debug="on"` | Say what it does in the browser console (F12), for testing |

If the quiz is taken again, the newest attempt's score replaces the last one.

**Testing it:** publish the Lectora course as SCORM, upload it to SCORM Cloud, launch it there,
take the quiz, then look at the registration's score and status in SCORM Cloud. With
`data-debug="on"` the console shows `Lectora: AICC_Score = 90 / AICC_Lesson_Status = passed`.

The quiz can't do this from inside its Web Window: it's a frame from another site, and browsers
keep that out of the course's own SCORM connection. The script runs in the course's page, which can
reach it.

### Doing it by hand instead

The script is the two pieces below; use them yourself if you'd rather, or to do something else with
the result.

**The learner:** the quiz reads `learner_name`, with `learner_email` or `learner_id` (their LMS id:
letters, digits and `. _ @ : + -`, up to 100), from its address, and then doesn't ask. A bad email
or id is ignored and the quiz asks instead, so a course can't record the wrong person.

**The score:** when it's finished, the quiz posts this to the page around it:

```js
{ source: 'elearning-react', type: 'finished', quizId: 'midi-basics',
  score: { raw: 8, max: 10, scaled: 0.8 }, passed: true }
```

For example, to put it in Lectora variables of your own (`QuizScore`, `QuizPassed`) for Lectora's
actions to use:

```html
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://learn.tribeofabraham.com') return
    if (!e.data || e.data.source !== 'elearning-react' || e.data.type !== 'finished') return
    VarQuizScore.set(String(Math.round(e.data.score.scaled * 100)))
    VarQuizPassed.set(e.data.passed ? 'true' : 'false')
  })
</script>
```

There are other messages too: `started`, `answered` (with `questionId` and `correct`) and `resize`
(with the quiz's `height`).

## Where the results go

Two records, which agree:

- **The LMS (SCORM):** the course's score and passed / failed, set by `lectora.js` (step 2).
- **The quiz's LRS (xAPI, in SCORM Cloud):** the detail. Initialized, every answer with its
  response and time, passed or failed with the score, and completed.

To have the quiz write straight to the LMS's own LRS instead, the LMS would launch it the standard
xAPI way, with `endpoint`, `auth` and `actor` in the address (see the README). A Lectora Web Window
doesn't do that on its own.

## Not supported: importing the files into the course

The quiz needs its server to record attempts, so copying the built files into a Lectora course
(rather than pointing a Web Window at the address) would show the quiz but record nothing.
