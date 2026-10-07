# Using the quiz in a Lectora course

The quiz runs at an address (https://learn.tribeofabraham.com), so in Lectora it goes in a **Web
Window** (web object) like any web page. It sizes itself to the window, records each attempt with
xAPI in the quiz's own LRS (SCORM Cloud), and tells the course page its score.

> The quiz side of this is tested. The Lectora side (menu names, how its variables are reached from
> a script) is written from how Lectora generally works, not tried in Lectora itself: try it in a
> test course before a real one, and adjust names to your version.

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

## 2. Tell the quiz who the learner is

When the course is running in an LMS, Lectora knows the learner. Pass them to the quiz and it skips
its "Who is taking the quiz?" step:

| Address option | What it is |
| --- | --- |
| `learner_name` | Their name, as shown in the LRS |
| `learner_email` | Their email: recorded as their identity (`mailto:`) |
| `learner_id` | Their LMS id, if there's no email: letters, digits and `. _ @ : + -`, up to 100 |

A bad email or id is ignored and the quiz asks instead, so a course can't record someone as the
wrong person.

Lectora's reserved variables `AICC_Student_Name` and `AICC_Student_ID` hold the learner when the
course is published to an LMS. In a script (an **HTML Extension** on the page, of the JavaScript
kind), Lectora variables are objects named `Var` + the variable's name. This sets the Web Window's
address from them once the page has loaded:

```html
<script>
  window.addEventListener('load', function () {
    var frame = document.querySelector('iframe[src*="learn.tribeofabraham.com"]')
    if (!frame) return
    var url = new URL(frame.src)
    try { url.searchParams.set('learner_name', VarAICC_Student_Name.getValue()) } catch (e) {}
    try { url.searchParams.set('learner_id', VarAICC_Student_ID.getValue()) } catch (e) {}
    frame.src = url.toString()
  })
</script>
```

If the LMS's student id is an email address, use `learner_email` in place of `learner_id`.

## 3. Get the score back into Lectora

The quiz posts a message to the page around it when it's finished:

```js
{ source: 'elearning-react', type: 'finished', quizId: 'midi-basics',
  score: { raw: 8, max: 10, scaled: 0.8 }, passed: true }
```

Make two Lectora variables, say `QuizScore` and `QuizPassed`, then in the same HTML Extension:

```html
<script>
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'elearning-react' || e.data.type !== 'finished') return
    VarQuizScore.set(String(Math.round(e.data.score.scaled * 100)))
    VarQuizPassed.set(e.data.passed ? 'true' : 'false')
  })
</script>
```

Lectora's own actions can then use them: show a Next button only when `QuizPassed` is `true`, say,
or set the course's score and completion for the LMS. (Lectora acts on a variable when something
triggers an action, so check it on a button press or a timer rather than expecting the page to
react the moment it changes.)

There are other messages too, if they're useful: `started`, `answered` (with `questionId` and
`correct`) and `resize` (with the quiz's `height`).

## Where the results go

Each attempt is recorded in the quiz's LRS (SCORM Cloud): initialized, each answer, passed or
failed with the score, and completed. That's separate from the LMS's own record of the Lectora
course, which gets the score only if step 3 passes it on.

To have the quiz write straight to the LMS's own LRS instead, the LMS would launch it the standard
xAPI way, with `endpoint`, `auth` and `actor` in the address (see the README). A Lectora Web Window
doesn't do that on its own.

## Not supported: importing the files into the course

The quiz needs its server to record attempts, so copying the built files into a Lectora course
(rather than pointing a Web Window at the address) would show the quiz but record nothing.
