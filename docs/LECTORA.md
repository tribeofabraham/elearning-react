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

- **Size:** any. The quiz's top bar and footer stay put and the quiz scrolls between them, by mouse
  wheel, touch or keyboard, even in a Web Window with scrolling off and its overflow hidden (tested
  at 505 × 644 that way). A wide, short window (about 3:2 or wider, under 600 pixels tall) gets a
  two-column layout that fits without scrolling (tested at 820 × 434).
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
   so the quiz doesn't ask. (An id that's an email address is recorded as one.) It's sent as a
   message, not in the address, so it stays out of addresses and server logs.
2. **Puts the score into the course's SCORM record** when the quiz is finished:
   - in Lectora, by setting its reserved variables, which Lectora sends to the LMS as they change:
     `AICC_Score` (the percentage; in SCORM 2004 Lectora sends it as `cmi.score.raw` and
     `cmi.score.scaled` = score / 100), `AICC_Lesson_Status` (`passed` or `failed`; 2004:
     `cmi.success_status`) and, in SCORM 2004, `CMI_Completion_Status` (`completed`);
   - on a page that isn't Lectora's, straight to the LMS's SCORM API (2004 or 1.2).

Options on the script tag:

| | |
| --- | --- |
| `data-status="off"` | Set the score only, not passed / failed (if the course decides those itself) |
| `data-debug="on"` | Say what it does in the browser console (F12), for testing |

If the quiz is taken again, the newest attempt's score replaces the last one.

**Previewing it** before publishing: open `docs/lectora-preview.html` (from this repo, in a
browser). It's a stand-in Lectora page: the live quiz in an 820 × 434 Web Window, `lectora.js`, and
Lectora's variables faked, with a panel showing what the course would send to SCORM. It isn't
published on the quiz's site.

**Testing it:** publish the Lectora course as SCORM, upload it to SCORM Cloud, launch it there,
take the quiz, then look at the registration's score and status in SCORM Cloud. With
`data-debug="on"` the console shows `Lectora: AICC_Score = 90 / AICC_Lesson_Status = passed`.

The quiz can't do this from inside its Web Window: it's a frame from another site, and browsers
keep that out of the course's own SCORM connection. The script runs in the course's page, which can
reach it.

### Or: a Run JavaScript action

If the page already handles the quiz in an On Show **Run JavaScript** action, replace that action's
code with [`lectora-run-javascript.js`](lectora-run-javascript.js) (in this folder). It does the
same as `lectora.js`: the learner in, and the score, `AICC_Lesson_Status` and (SCORM 2004)
`CMI_Completion_Status` out, plus the course's own `quizScore` variable if it has one. Tested in a
stand-in of that page (505 × 644, scrolling off, a different site from the quiz).

If the page has a button that copies `quizScore` into `AICC_Score`, it's no longer needed (the
script sets `AICC_Score` itself), and pressed before the quiz is finished it would send 0.

### Doing it by hand instead

The script is the two pieces below; use them yourself if you'd rather, or to do something else with
the result.

**The learner:** when the quiz can take it, it posts `{ source: 'elearning-react', type: 'ready' }`
to the page. Send it, to the quiz's frame and origin only:

```js
frame.contentWindow.postMessage(
  { source: 'elearning-host', type: 'learner', name: 'Lovelace, Ada', id: 'alovelace', homePage: location.origin },
  'https://learn.tribeofabraham.com')
```

- `name`: as the LMS has it; "Last, First" is shown and recorded as "First Last".
- `id`: their LMS id (letters, digits and `. _ @ : + -`, up to 100).
- `homePage`: the LMS's address (the course page's `location.origin`). With it, the learner is
  recorded as that LMS's account, `{ name, account: { homePage, name: id } }`; without it, under
  the quiz's own address (and an id that's an email address is recorded as an email).
- Any may be empty. With an id, the quiz doesn't ask who's taking it; with only a name, it fills
  in the name and asks the rest; with nothing, it's as if no message came.
- All of it is treated as unverified input: the name is tidied, `homePage` cut to an http(s)
  origin, and a bad id ignored. Send it on `ready`, or straight away, or both: the quiz takes it any time before it's
started, and only from the page embedding it. (The same can go in the address as `learner_name`
with `learner_email` or `learner_id`, but a message keeps it out of server logs.) A bad email or id
is ignored and the quiz asks instead, so a course can't record the wrong person.

**The score:** when it's finished, the quiz posts this to the page around it:

```js
{ source: 'elearning-react', type: 'finished', quizId: 'midi-basics',
  score: { raw: 8, max: 10, scaled: 0.8 }, passed: true }
```

Note that in a published Lectora page the course's own variables are named `Var` + their name
(`VarQuizScore`), but Lectora's reserved ones keep their names (`AICC_Score`, `AICC_Lesson_Status`).
Setting only `AICC_Score` sends the score but leaves passed / failed to whatever else decides it, so
set `AICC_Lesson_Status` as well. For example, to put the result in variables of your own
(`QuizScore`, `QuizPassed`) for Lectora's actions to use:

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
(with the quiz's full `height`, for a page that wants to size its frame to fit; it doesn't have to,
since the quiz scrolls within any size).

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
