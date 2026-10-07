# elearning-react

Scoreable e-learning components that drop into anything. The first is a ten-question **MIDI Basics**
quiz: built in React, served by a small Node.js server, and recorded with **xAPI** in a Learning
Record Store (LRS) such as SCORM Cloud.

- **Embed it anywhere** as an iframe. It sizes itself to the frame and tells the host page when it
  starts, each answer, and the final score (`postMessage`).
- **Launch it from an LMS** the standard xAPI way, and it records to that LMS's own LRS.
- **Or run it on its own:** learners give a name and email (or stay anonymous) and the server
  records the attempt in your LRS.
- **See the xAPI as it's sent:** a small "{ } xAPI" button in the footer (an easter egg for demos)
  opens a dialog listing each statement in plain words (who did what, the response, right or wrong,
  the score, the time), whether the LRS stored it, and its JSON. `?xapi-panel=0` hides the button.
- **In Lectora (or any SCORM course):** in a Web Window, plus one line on the page,
  `<script src="https://learn.tribeofabraham.com/lectora.js"></script>`, which passes the learner in
  and puts the score and passed / failed into the course's SCORM record. See
  [docs/LECTORA.md](docs/LECTORA.md).

- **WCAG 2.2 AA:** keyboard and screen reader friendly (focus moves to each question and its
  feedback; right and wrong are said in words, not just colour), colour contrast held by a test,
  everything in em and scaled to the space by a sizer, with an Auto-scale text switch. Checked
  with axe: no violations.

## How an attempt is recorded

```
On its own or embedded:
  browser ──POST api/statements { quizId, registration, learner, event }──▶ Node server ──▶ your LRS
          (what happened only)                      builds and scores the statements here

Launched by an LMS (?endpoint=…&auth=…&actor=…):
  browser ──xAPI statements──▶ the LMS's LRS
```

The server builds the statements and scores the attempt itself, with the same code the page uses
(`shared/`), so the LRS key never reaches the browser and a score can't be made up in it.

Each attempt has one `registration` and records:

| Verb | Object | Result |
| --- | --- | --- |
| `initialized` | the quiz (an assessment) | |
| `answered` | each question (a `cmi.interaction`, with its choices and right answer) | response, success, duration |
| `passed` or `failed` | the quiz | score (raw, min, max, scaled), success, duration |
| `completed` | the quiz | duration |

Verbs are ADL's (`http://adlnet.gov/expapi/verbs/…`). Activities are
`<ACTIVITY_BASE>/<quiz id>` and `…/questions/<question id>`; an LMS's `activity_id` replaces the first.

## Using it

| Address | What it does |
| --- | --- |
| `/` or `/?quiz=midi-basics` | The quiz |
| `/?xapi-panel=0` | The quiz without the "{ } xAPI" button |
| `/?learner_name=…&learner_email=…` or `&learner_id=…` | The learner, from the page embedding it: skips "Who is taking the quiz?" |
| `/embed-demo.html` | The quiz embedded in a page, showing the messages it sends and the embed code |
| `/?endpoint=<LRS>&auth=<Basic …>&actor=<JSON>&registration=<uuid>&activity_id=<IRI>` | An LMS launch |
| `/api/health` | `{ ok, lrs: 'mock' \| 'configured' }` |

**Embedding:**

```html
<iframe src="https://learn.tribeofabraham.com/?quiz=midi-basics" title="MIDI Basics quiz"
        style="width:100%; height:44rem; border:0"></iframe>
<script>
  window.addEventListener('message', (e) => {
    if (e.data?.source !== 'elearning-react') return
    // e.data.type: 'started' | 'answered' | 'finished' | 'resize'
    if (e.data.type === 'finished') console.log(e.data.score.scaled, e.data.passed)
    if (e.data.type === 'resize') { /* e.data.height: the content's height, to size the frame */ }
  })
</script>
```

## Project layout

| Path | What it is |
| --- | --- |
| `shared/quizzes/` | The quizzes, one file each (`midi-basics.js`); list a new one in `index.js` |
| `shared/quiz.js` | Scoring and checking a quiz file |
| `shared/xapi.js` | The xAPI statements for an attempt |
| `shared/email.js` | Email rules for the page and the server |
| `server/index.js` | Express: `api/statements` to the LRS, plus the built page |
| `src/` | The React app: `App.jsx`, `components/` (including `XapiViewer.jsx`), `recorder.js` (server or LMS, with the live log), `xapiText.js` (statements in words), `launch.js`, `embed.js`, `sizer.js` |
| `public/embed-demo.html` | The embedding demo |
| `public/lectora.js` | For a Lectora / SCORM course page: the learner in, the score into SCORM |
| `deploy/` | Setup and deploy scripts for the VPS, and its systemd unit |

A question is `{ id, type: 'choice', prompt, choices: [{ id, text }], answer, explanation }` or
`{ id, type: 'true-false', prompt, answer: true|false, explanation }`. The tests check every quiz.

## Running locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the LRS endpoint, key and secret. Leave them blank to use
   a mock LRS that prints statements in the server's console (development only: with
   `NODE_ENV=production` the server won't start without them).
3. `npm run dev` and open the address Vite prints.

`npm test` runs the scoring, statement, statement-in-words and colour-contrast tests. To try the production setup:
`npm run build`, then `npm start`, and open `http://localhost:3030`.

## Deploying

It runs on the Ragamuffin Studios VPS (`50.6.206.202`, AlmaLinux 9), beside the Ragamuffin dashboard:
Node.js runs the server on `127.0.0.1:3030` as a systemd service, and **Caddy** serves it over HTTPS
at **https://learn.tribeofabraham.com** (with a certificate it gets and renews itself). Bluehost's
shared hosting can't run Node, which is why it isn't on the main site's server.

**Once:**

1. In Bluehost, add an **A record** for `learn` on tribeofabraham.com pointing to `50.6.206.202`.
2. `npm run setup` (from Git Bash, with the SSH key that logs in as root): installs Node 22, the
   `elearning` user and the service, and, once the A record works, adds the HTTPS site to Caddy.
   Run it again after adding the record if it was too early.

**Each time** (after committing and pushing): `npm run deploy`. It refuses unless this copy matches
GitHub, runs the tests, builds the page, sends it all up, installs the server's packages, restarts
the service and checks it answers. The first deploy copies your `.env` (the LRS details) to the
server; after that the server's own copy is kept.

| | |
| --- | --- |
| `deploy/setup.sh` | One-time server setup (safe to rerun) |
| `deploy/deploy.sh` | Each deploy |
| `deploy/elearning-react.service` | The systemd unit (`journalctl -u elearning-react -f` for its log) |

Another server or address: `ELEARNING_SERVER=root@<ip> ELEARNING_DOMAIN=<name> npm run deploy`.

## License

MIT
