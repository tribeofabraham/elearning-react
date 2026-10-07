# elearning-react

Scoreable e-learning components that drop into anything. The first is a ten-question **MIDI Basics**
quiz: built in React, served by a small Node.js server, and recorded with **xAPI** in a Learning
Record Store (LRS) such as SCORM Cloud.

- **Embed it anywhere** as an iframe. It sizes itself to the frame and tells the host page when it
  starts, each answer, and the final score (`postMessage`).
- **Launch it from an LMS** the standard xAPI way, and it records to that LMS's own LRS.
- **Or run it on its own:** learners give a name and email (or stay anonymous) and the server
  records the attempt in your LRS.
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
| `src/` | The React app: `App.jsx`, `components/`, `recorder.js` (server or LMS), `launch.js`, `embed.js`, `sizer.js` |
| `public/embed-demo.html` | The embedding demo |
| `deploy/` | systemd unit, nginx site and update script for a VPS |

A question is `{ id, type: 'choice', prompt, choices: [{ id, text }], answer, explanation }` or
`{ id, type: 'true-false', prompt, answer: true|false, explanation }`. The tests check every quiz.

## Running locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the LRS endpoint, key and secret. Leave them blank to use
   a mock LRS that prints statements in the server's console (development only: with
   `NODE_ENV=production` the server won't start without them).
3. `npm run dev` and open the address Vite prints.

`npm test` runs the scoring, statement and colour-contrast tests. To try the production setup:
`npm run build`, then `npm start`, and open `http://localhost:3030`.

## Deploying to a VPS

Bluehost's shared hosting can't run Node, so the server runs on a VPS (Ubuntu 22.04 or 24.04 here)
behind nginx, at a subdomain such as `learn.tribeofabraham.com`.

**Once:**

```bash
# Node 22, nginx, certbot
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git

# A user to run it, and the code
sudo useradd --system --create-home --home-dir /srv/elearning-react --shell /usr/sbin/nologin elearning
sudo -u elearning git clone https://github.com/tribeofabraham/elearning-react.git /srv/elearning-react
cd /srv/elearning-react
sudo -u elearning cp .env.example .env && sudo -u elearning nano .env    # the LRS details
sudo chmod 600 .env
sudo -u elearning npm ci --include=dev && sudo -u elearning npm run build

# Keep it running, and put it on the web
sudo cp deploy/elearning-react.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now elearning-react
sudo cp deploy/nginx.conf /etc/nginx/sites-available/elearning-react     # set server_name first
sudo ln -s /etc/nginx/sites-available/elearning-react /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Then in Bluehost's **Zone Editor**, add an `A` record for `learn` pointing to the VPS's IP address,
and once it resolves: `sudo certbot --nginx -d learn.tribeofabraham.com`.

**Each update** (after pushing to GitHub): on the VPS, run `/srv/elearning-react/deploy/update.sh` as
your admin user. It pulls, installs, tests, builds and restarts the server, then checks it's answering.

## License

MIT
