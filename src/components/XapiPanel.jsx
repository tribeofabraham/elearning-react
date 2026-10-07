import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { describeStatement } from '../xapiText.js'

const STATUS = { sending: 'Sending…', stored: '✓ Stored', failed: '✗ Not stored' }
const OPEN_KEY = 'elearning-react:xapi-panel-open'

const readOpen = () => {
  try { return localStorage.getItem(OPEN_KEY) !== 'closed' } catch { return true }
}
const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// A panel along the bottom showing the xAPI the quiz sends, as it's sent: each statement in plain words
// (who, did what, to what, and the result), whether the LRS has it, and its JSON. Collapses to a bar.
export default function XapiPanel({ log, mode }) {
  const [open, setOpen] = useState(readOpen)
  const listRef = useRef(null)
  const statements = log.reduce((n, e) => n + e.statements.length, 0)
  const last = log[log.length - 1]

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed') } catch { /* a convenience only */ }
  }, [open])

  // The page leaves room for the panel at the bottom, so nothing is stuck behind it
  const panelRef = useRef(null)
  useEffect(() => {
    const el = panelRef.current
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--panel-height', `${el.offsetHeight}px`))
    observer.observe(el)
    return () => { observer.disconnect(); root.style.removeProperty('--panel-height') }
  }, [])

  // Follow new entries, unless the reader has scrolled up to look at an earlier one
  const following = useRef(true)
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && following.current) el.scrollTop = el.scrollHeight
  }, [log, open])

  return (
    <aside className={`xapi-panel${open ? ' is-open' : ''}`} ref={panelRef} aria-labelledby="xapi-panel-title">
      <div className="xapi-bar">
        <h2 id="xapi-panel-title">xAPI</h2>
        <p className="xapi-summary">
          {statements} statement{statements === 1 ? '' : 's'}
          {last && <> · last: {last.event} <span className={`xapi-status is-${last.status}`}>{STATUS[last.status]}</span></>}
          <span className="xapi-route"> · {mode === 'lms' ? 'to your LMS’s LRS' : 'through this site’s server'}</span>
        </p>
        <button type="button" className="xapi-toggle" aria-expanded={open} aria-controls="xapi-list" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}<span className="visually-hidden"> xAPI statements</span>
        </button>
      </div>

      <div id="xapi-list" className="xapi-list" ref={listRef} hidden={!open} tabIndex={0} aria-label="xAPI statements sent"
           onScroll={(e) => {
             const el = e.currentTarget
             following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8
           }}>
        {log.length === 0 && <p className="xapi-empty">Nothing sent yet. Statements appear here as you take the quiz.</p>}
        <ol>
          {log.map((entry) => (
            <li key={entry.id} className={`xapi-entry is-${entry.status}`}>
              <p className="xapi-head">
                <span className="xapi-time">{time(entry.at)}</span>
                <span className={`xapi-status is-${entry.status}`}>{STATUS[entry.status]}</span>
                {entry.error && <span className="xapi-error">{entry.error}</span>}
              </p>
              {entry.statements.length === 0 && entry.status !== 'failed' && (
                <p className="xapi-line"><span className="xapi-verb">{entry.event}</span> event sent to the server…</p>
              )}
              {entry.statements.map((s) => {
                const d = describeStatement(s)
                return (
                  <div key={s.id} className="xapi-statement">
                    <p className="xapi-line">
                      {d.actor} <span className="xapi-verb">{d.verb}</span> <q>{d.object}</q>
                    </p>
                    {d.details.length > 0 && (
                      <dl className="xapi-details">
                        {d.details.map((x) => (
                          <div key={x.label} className={x.tone ? `is-${x.tone}` : undefined}>
                            <dt>{x.label}</dt><dd>{x.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <details className="xapi-json">
                      <summary>JSON<span className="visually-hidden"> for “{d.verb}”</span></summary>
                      <pre tabIndex={0}>{JSON.stringify(s, null, 2)}</pre>
                    </details>
                  </div>
                )
              })}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
