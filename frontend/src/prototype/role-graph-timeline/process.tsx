// PROTOTYPE (tyey/rolegraph#13): a Process with its Participants and Timeline.
import { useEffect, useRef, useState } from 'react'
import type { Db, Outcome, Process, Side, Status, Step, StepState } from './data'
import { agencyName, companyName, DecisionMaker, fields, processState, STATE_STYLE, StatePill, fmtDay, isOpen, personName, roleName, timeline, uid, useStore } from './store'
import { AddChip, Avatar, Card, Menu, Stat, T } from './ui'

const STATUSES: Status[] = ['Active', 'On hold', 'Offer received']
const OUTCOMES: Outcome[] = ['Accepted', 'Declined', 'Rejected', 'Withdrawn', 'Ghosted']
const SIDES: Side[] = ['Company', 'Talent team', 'Agency', 'none']
const stateStyle: Record<StepState, string> = {
  Done: 'border-emerald-500 bg-emerald-500',
  Planned: 'border-sky-500 bg-white',
  Cancelled: 'border-slate-300 bg-slate-200',
}

const P = (d: Db, id: string) => d.processes.find((p) => p.id === id)!

const show = (v: unknown) => (v === undefined || v === '' ? '—' : typeof v === 'string' ? v : JSON.stringify(v))

export function ConflictBanner() {
  const { conflict, resolveConflict, db } = useStore()
  const [keepTheirs, setKeepTheirs] = useState<string[]>([])
  if (!conflict) return null
  const theirs = P(db, conflict.processId)
  const mineDb = structuredClone(db)
  mineDb.processes = mineDb.processes.map((x) => (x.id === theirs.id ? structuredClone(conflict.base) : x))
  conflict.retry(mineDb)
  const [b, t, m] = [conflict.base, theirs, P(mineDb, theirs.id)].map((x) => new Map(fields(x).map((f) => [f.key, f])))
  const eq = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
  const rows = [...new Set([...t.keys(), ...m.keys()])]
    .map((k) => ({ k, label: (t.get(k) ?? m.get(k))!.label, base: b.get(k)?.val, theirs: t.get(k)?.val, mine: m.get(k)?.val }))
    .filter((r) => !eq(r.theirs, r.base) || !eq(r.mine, r.base))
    .map((r) => ({ ...r, clash: !eq(r.theirs, r.base) && !eq(r.mine, r.base) && !eq(r.theirs, r.mine) }))
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16">
      <div className="w-[820px] rounded-lg border-2 border-amber-500 bg-white p-4 text-sm shadow-2xl">
        <div className="font-semibold">409 · “{companyName(db, theirs)}” was changed by an agent while you were editing</div>
        <div className="mt-1 text-xs text-slate-600">
          Your change “{conflict.what}” was not saved. Fields only one side changed are kept automatically; for fields both changed, pick which to keep.
        </div>
        <table className="mt-3 w-full table-fixed text-xs">
          <thead className={T.thead}>
            <tr>
              <th className="w-44">Field</th>
              <th>Before</th>
              <th>Theirs (agent, v{theirs.version})</th>
              <th>Yours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pickTheirs = r.clash ? keepTheirs.includes(r.k) : eq(r.mine, r.base)
              const cell = (side: 'theirs' | 'mine') => (
                <td className={`whitespace-pre-wrap break-words p-1 align-top ${(side === 'theirs') === pickTheirs ? 'bg-emerald-50 font-medium' : 'text-slate-400 line-through'}`}>
                  {r.clash && (
                    <input
                      type="radio"
                      className="mr-1"
                      checked={(side === 'theirs') === pickTheirs}
                      onChange={() => setKeepTheirs((ks) => (side === 'theirs' ? [...ks, r.k] : ks.filter((x) => x !== r.k)))}
                    />
                  )}
                  {show(side === 'theirs' ? r.theirs : r.mine)}
                </td>
              )
              return (
                <tr key={r.k} className={`border-t ${r.clash ? 'bg-amber-50' : ''}`}>
                  <td className="p-1 align-top">
                    {r.label}
                    {r.clash && <div className="text-xs font-semibold text-amber-700">both changed</div>}
                  </td>
                  <td className="whitespace-pre-wrap break-words p-1 align-top text-slate-500">{show(r.base)}</td>
                  {cell('theirs')}
                  {cell('mine')}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded bg-amber-600 px-3 py-1 text-white"
            onClick={() => {
              resolveConflict(keepTheirs)
              setKeepTheirs([])
            }}
          >
            Save merged version
          </button>
          <button
            className="rounded border px-3 py-1"
            onClick={() => {
              resolveConflict(null)
              setKeepTheirs([])
            }}
          >
            Drop my change, keep theirs
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProcessPanel({ id }: { id: string; wide?: boolean }) {
  const { db, write, nav, search } = useStore()
  const p = db.processes.find((x) => x.id === id)
  const [closing, setClosing] = useState(false)
  const [moving, setMoving] = useState(false)
  if (!p) return <div className="p-6 text-slate-400">Pick a Process.</div>
  const w = (what: string, fn: (d: Db) => void) => write(what, fn, p.id)
  const agency = agencyName(db, p)
  const tl = timeline(p.steps)
  const next = tl.find((s) => s.state === 'Planned')
  const origin = tl.find((s) => s.origin)

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            <button className="rounded-full border bg-white px-2 py-0.5 font-medium text-slate-800 hover:border-indigo-300" onClick={() => nav({ role: p.roleId, tab: 'role' })}>
              {roleName(db, p.roleId)}
            </button>
            {agency && <span>via {agency}</span>}
          </div>
          <h2 className={T.page}>{companyName(db, p)}</h2>
          {!p.companyId && <div className="mt-0.5 text-xs text-amber-700">The Agency hasn’t named the Company yet</div>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isOpen(p) ? (
              <>
                <select
                  className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-medium ${STATE_STYLE[processState(p)].pill}`}
                  value={p.status}
                  onChange={(e) => w('change Status', (d) => (P(d, p.id).status = e.target.value as Status))}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={() => setClosing(true)}>
                  Close Process
                </button>
              </>
            ) : (
              <>
                <StatePill p={p} />
                <button
                  className="rounded-full border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() =>
                    w('reopen', (d) => {
                      P(d, p.id).outcome = undefined
                      P(d, p.id).status = 'Active'
                    })
                  }
                >
                  Reopen
                </button>
              </>
            )}
          </div>
        </div>
        <Menu items={[['Move to another Role…', () => setMoving(true)]]} />
      </header>

      {moving && (
        <Card>
          <div className="mb-2 flex items-center">
            <span className={T.label}>Move to</span>
            <button className="ml-auto text-slate-400 hover:text-slate-700" aria-label="Close" onClick={() => setMoving(false)}>
              ×
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {db.roles
              .filter((r) => r.id !== p.roleId)
              .map((r) => (
                <button
                  key={r.id}
                  className="rounded-full border px-3 py-1 text-sm hover:border-indigo-300 hover:bg-indigo-50"
                  onClick={() => {
                    w('reclassify', (d) => (P(d, p.id).roleId = r.id))
                    setMoving(false)
                  }}
                >
                  {r.name}
                </button>
              ))}
          </div>
        </Card>
      )}
      {closing && <CloseDialog p={p} onDone={() => setClosing(false)} />}

      <div className="grid grid-cols-3 gap-3">
        <Stat n={next ? next.kind : '—'} label={next ? `Next · ${fmtDay(next.day)}` : 'Nothing planned'} />
        <Stat n={p.steps.filter((s) => s.state === 'Done').length} label="Steps done" />
        <Stat n={origin?.day ? fmtDay(origin.day) : '—'} label={`Started · ${origin?.channel ?? ''}`} />
      </div>

      <Notes big label="Process prep notes" value={p.prep} onSave={(v) => w('edit Process prep notes', (d) => (P(d, p.id).prep = v))} />
      <Participants p={p} />
      <section>
        <h3 className={`mb-3 ${T.section}`}>Timeline</h3>
        <Timeline p={p} openStep={search.step} />
        <AddStep p={p} />
      </section>
    </div>
  )
}

function CloseDialog({ p, onDone }: { p: Process; onDone: () => void }) {
  const { write } = useStore()
  const planned = p.steps.filter((s) => s.state === 'Planned')
  const allowed = OUTCOMES.filter((o) => (o === 'Accepted' || o === 'Declined' ? p.status === 'Offer received' : o === 'Withdrawn' ? p.status !== 'Offer received' : true))
  const [outcome, setOutcome] = useState<Outcome>(allowed[0])
  const [cancel, setCancel] = useState(true)
  return (
    <div className="rounded-xl border bg-white p-4 text-sm shadow-sm">
      <div className="font-semibold">Close this Process</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {allowed.map((o) => (
          <label key={o} className="flex items-center gap-1">
            <input type="radio" checked={outcome === o} onChange={() => setOutcome(o)} /> {o}
          </label>
        ))}
      </div>
      {planned.length > 0 && (
        <label className="mt-2 flex items-start gap-2">
          <input type="checkbox" checked={cancel} onChange={(e) => setCancel(e.target.checked)} />
          <span>
            Cancel the {planned.length} Planned Step{planned.length > 1 && 's'}: {planned.map((s) => s.kind).join(', ')}
            <span className="block text-xs text-slate-500">(A Closed Process can’t keep Planned Steps; unticking keeps it open.)</span>
          </span>
        </label>
      )}
      <div className="mt-2 flex gap-2">
        <button
          disabled={planned.length > 0 && !cancel}
          className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-40"
          onClick={() => {
            write(
              `close as ${outcome}`,
              (d) => {
                const x = P(d, p.id)
                x.outcome = outcome
                x.status = undefined
                x.steps.forEach((s) => s.state === 'Planned' && (s.state = 'Cancelled'))
              },
              p.id,
            )
            onDone()
          }}
        >
          Close as {outcome}
        </button>
        <button className="rounded border px-3 py-1" onClick={onDone}>
          Back
        </button>
      </div>
    </div>
  )
}

function Timeline({ p, openStep }: { p: Process; openStep?: string }) {
  const { db, write, nav } = useStore()
  const steps = timeline(p.steps)
  const undated = steps.filter((s) => !s.origin && !s.day)
  const move = (sid: string, dir: -1 | 1) =>
    write(
      'reorder undated Steps',
      (d) => {
        const arr = P(d, p.id).steps
        const und = arr.filter((s) => !s.origin && !s.day)
        const i = und.findIndex((s) => s.id === sid)
        const j = i + dir
        if (j < 0 || j >= und.length) return
        const ai = arr.indexOf(und[i])
        const aj = arr.indexOf(und[j])
        ;[arr[ai], arr[aj]] = [arr[aj], arr[ai]]
      },
      p.id,
    )
  return (
    <ol className="relative ml-3 border-l-2 border-slate-200">
      {steps.map((s, i) => {
        const prevDated = i > 0 && steps[i - 1].day
        return (
          <li key={s.id} className="mb-3 ml-5">
            {!s.day && !s.origin && prevDated && <div className="-ml-5 mb-2 text-xs uppercase tracking-wide text-slate-400">— not scheduled yet —</div>}
            <span className={`absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 ${stateStyle[s.state]}`} />
            <div
              className={`relative rounded-xl border bg-white p-3 ${s.state === 'Cancelled' ? 'opacity-50' : ''} ${openStep === s.id ? 'ring-2 ring-indigo-400' : 'cursor-pointer hover:border-indigo-300'}`}
              onClick={() => openStep !== s.id && nav({ step: s.id }, true)}
            >
              <div className={`flex flex-wrap items-baseline gap-2 text-sm ${openStep === s.id ? 'pr-40' : ''}`}>
                <button className={`font-semibold ${s.state === 'Cancelled' ? 'line-through' : ''}`} >
                  {s.kind}
                </button>
                {s.origin && <span className="rounded bg-indigo-100 px-1.5 text-xs text-indigo-800">Origin · {s.channel}</span>}
                <span className="text-xs text-slate-600">
                  {fmtDay(s.day)}
                  {s.time && ` ${s.time}`}
                  {s.endDay && ` → due ${fmtDay(s.endDay)}`}
                </span>
                <span className="text-xs text-slate-500">{s.state}</span>
                <span className="ml-auto flex gap-1 text-xs">
                  {!s.day && !s.origin && (
                    <>
                      <button disabled={undated[0] === s} onClick={() => move(s.id, -1)}>
                        ▲
                      </button>
                      <button disabled={undated.at(-1) === s} onClick={() => move(s.id, 1)}>
                        ▼
                      </button>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                {s.participants.map((pid) => (
                  <button key={pid} className="rounded bg-slate-100 px-1.5 hover:bg-slate-200" onClick={(e) => (e.stopPropagation(), nav({ person: pid }))}>
                    {personName(db, pid)}
                  </button>
                ))}
                {s.docs.map((sd) => {
                  const doc = db.docs.find((x) => x.id === sd.docId)!
                  return (
                    <span key={sd.docId} className="rounded border border-dashed px-1.5" title={`sha256 ${doc.sha}`}>
                      📄 {sd.fileName} <span className="text-slate-400">{doc.kind} · {doc.direction}</span>
                    </span>
                  )
                })}
              </div>
              {openStep === s.id ? (
                <StepDetail p={p} s={s} />
              ) : (
                (s.prep || s.reflection || s.feedback.length > 0) && (
                  <div className="mt-2 space-y-1 border-t pt-1 text-xs">
                    {s.prep && (
                      <div className="whitespace-pre-wrap">
                        <span className="font-semibold text-slate-500">Prep notes · </span>
                        {s.prep}
                      </div>
                    )}
                    {s.reflection && (
                      <div className="whitespace-pre-wrap">
                        <span className="font-semibold text-slate-500">Reflection · </span>
                        {s.reflection}
                      </div>
                    )}
                    {s.feedback.map((f, k) => (
                      <div key={k}>
                        <span className="font-semibold text-slate-500">
                          Feedback · {fmtDay(f.day)} · {f.participantPersonId ? personName(db, f.participantPersonId) : (f.fromSide ?? 'unknown')}:{' '}
                        </span>
                        {f.text}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Edits a draft of the Step: ✓ (or a click anywhere outside the tile) saves it in one write, ✕ throws it away. */
function StepDetail({ p, s }: { p: Process; s: Step }) {
  const { db, write, nav } = useStore()
  const [draft, setDraft] = useState<Step>(() => structuredClone(s))
  const [deleting, setDeleting] = useState(false)
  const [fb, setFb] = useState('')
  const [fbBy, setFbBy] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const w = (fn: (st: Step) => void) =>
    setDraft((cur) => {
      const x = structuredClone(cur)
      fn(x)
      return x
    })
  const dirty = JSON.stringify(draft) !== JSON.stringify(s)
  const approve = () => {
    if (dirty) write(`edit ${s.kind} Step`, (d) => (P(d, p.id).steps = P(d, p.id).steps.map((x) => (x.id === s.id ? draft : x))), p.id)
    nav({ step: undefined }, true)
  }
  const reject = () => nav({ step: undefined }, true)
  const approveRef = useRef(approve)
  approveRef.current = approve
  useEffect(() => {
    const on = (e: MouseEvent) => {
      const tile = ref.current?.closest('li')
      const t = e.target as HTMLElement
      // Clicks inside the tile, on the prototype bar or in a dialog don't count as "outside".
      if (!tile || tile.contains(t) || t.closest('.fixed')) return
      approveRef.current()
    }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [])

  return (
    <div ref={ref} className="mt-2 space-y-3 border-t pt-2 text-sm">
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button className="rounded border px-2" title="Discard changes" onClick={reject}>
          ✕
        </button>
        <button className="rounded bg-emerald-600 px-2 text-white" title="Save changes" onClick={approve}>
          ✓
        </button>
        <span className="mx-3 h-5 w-px bg-slate-300" />
        <button
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
          disabled={s.origin}
          title={s.origin ? 'The Origin can’t be deleted: every Process has exactly one' : 'Delete this Step'}
          aria-label="Delete this Step"
          onClick={() => setDeleting(true)}
        >
          {/* Final version: lucide-react Trash2 (shadcn's icon set). */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
      {deleting && (
      <div className="rounded border-2 border-red-400 bg-red-50 p-2 text-xs">
        <div className="font-semibold">Delete this {s.kind} Step for good?</div>
        <div className="mt-1">
          Everything on it will be lost: its day and state, who took part, Step prep notes, the Reflection, {s.feedback.length} Feedback and {s.docs.length} Document attachment
          {s.docs.length !== 1 && 's'}. The Documents themselves stay in rolegraph. If it just won’t happen, mark it Cancelled instead.
        </div>
        <div className="mt-2 flex gap-2">
          <button
            className="rounded bg-red-600 px-2 text-white"
            onClick={() => {
              write(`delete ${s.kind} Step`, (d) => (P(d, p.id).steps = P(d, p.id).steps.filter((x) => x.id !== s.id)), p.id)
              nav({ step: undefined }, true)
            }}
          >
            Delete Step
          </button>
          <button className="rounded border px-2" onClick={() => setDeleting(false)}>
            Keep it
          </button>
        </div>
      </div>
      )}
      {dirty && <div className="text-xs text-amber-700">Unsaved changes: ✓ or click outside saves, ✕ discards.</div>}
      <div className="flex flex-wrap gap-2">
        {(['Planned', 'Done', 'Cancelled'] as StepState[]).map((st) => (
          <button
            key={st}
            disabled={st === 'Planned' && !isOpen(p)}
            className={`rounded border px-2 text-xs disabled:opacity-30 ${draft.state === st ? 'bg-slate-800 text-white' : ''}`}
            onClick={() => w((x) => (x.state = st))}
          >
            {st}
          </button>
        ))}
        <input type="date" className="rounded border px-1 text-xs" value={draft.day ?? ''} onChange={(e) => w((x) => (x.day = e.target.value || undefined))} />
        <input type="time" className="rounded border px-1 text-xs" value={draft.time ?? ''} onChange={(e) => w((x) => (x.time = e.target.value || undefined))} />
        <label className="text-xs">
          end <input type="date" className="rounded border px-1" value={draft.endDay ?? ''} onChange={(e) => w((x) => (x.endDay = e.target.value || undefined))} />
        </label>
      </div>
      <div className="text-xs">
        <span className="font-semibold">Took part: </span>
        {p.participants.length === 0 && <span className="text-slate-400">no Participants on this Process yet</span>}
        {p.participants.map((pt) => (
          <label key={pt.personId} className="mr-2">
            <input
              type="checkbox"
              checked={draft.participants.includes(pt.personId)}
              onChange={(e) => w((x) => (x.participants = e.target.checked ? [...x.participants, pt.personId] : x.participants.filter((i) => i !== pt.personId)))}
            />{' '}
            {personName(db, pt.personId)}
          </label>
        ))}
      </div>
      {draft.docs.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {draft.docs.map((sd) => (
            <span key={sd.docId} className="rounded border border-dashed px-1.5">
              📄 {sd.fileName}{' '}
              <button className="text-slate-400 hover:text-red-600" title="detach from this Step" onClick={() => w((x) => (x.docs = x.docs.filter((y) => y.docId !== sd.docId)))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <AttachDoc attached={draft.docs.map((x) => x.docId)} onAttach={(docId, fileName) => w((x) => x.docs.push({ docId, fileName }))} />
      <label className={`block ${T.label}`}>
        Step prep notes
        <textarea className="mt-1 w-full rounded border p-1 text-sm font-normal" rows={3} value={draft.prep} onChange={(e) => w((x) => (x.prep = e.target.value))} />
      </label>
      <label className={`block ${T.label}`}>
        Reflection (yours, one per Step)
        <textarea className="mt-1 w-full rounded border p-1 text-sm font-normal" rows={3} value={draft.reflection} onChange={(e) => w((x) => (x.reflection = e.target.value))} />
      </label>
      <div>
        <div className={T.label}>Feedback</div>
        {draft.feedback.map((f, i) => (
          <div key={i} className="mt-1 flex rounded bg-slate-50 p-1 text-xs">
            <span className="flex-1">
              <span className="text-slate-500">{fmtDay(f.day)} · {f.participantPersonId ? personName(db, f.participantPersonId) : (f.fromSide ?? 'unknown')}:</span> {f.text}
            </span>
            <button className="text-slate-400 hover:text-red-600" title="remove this Feedback" onClick={() => w((x) => x.feedback.splice(i, 1))}>
              ×
            </button>
          </div>
        ))}
        <div className="mt-1 flex gap-1 text-xs">
          <input className="flex-1 rounded border px-1" placeholder="What they said…" value={fb} onChange={(e) => setFb(e.target.value)} />
          <select className="rounded border" value={fbBy} onChange={(e) => setFbBy(e.target.value)}>
            <option value="">from: Company</option>
            <option value="side:Talent team">from: Talent team</option>
            <option value="side:Agency">from: Agency</option>
            {p.participants.map((pt) => (
              <option key={pt.personId} value={pt.personId}>
                from: {personName(db, pt.personId)}
              </option>
            ))}
          </select>
          <button
            className="rounded border px-2"
            disabled={!fb}
            onClick={() => {
              w((x) =>
                x.feedback.push({
                  day: new Date().toISOString().slice(0, 10),
                  text: fb,
                  ...(fbBy.startsWith('side:') ? { fromSide: fbBy.slice(5) as Side } : fbBy ? { participantPersonId: fbBy } : { fromSide: 'Company' as Side }),
                }),
              )
              setFb('')
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function AttachDoc({ attached, onAttach }: { attached: string[]; onAttach: (docId: string, fileName: string) => void }) {
  const { db, write } = useStore()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(db.docKinds[0])
  const [dir, setDir] = useState<'Sent' | 'Received'>('Sent')
  if (!open)
    return (
      <button className="rounded border px-2 text-xs" onClick={() => setOpen(true)}>
        + Document
      </button>
    )
  return (
    <div className="rounded border p-2 text-xs">
      <div className="font-semibold">Pick an existing Document</div>
      {db.docs
        .filter((d) => !attached.includes(d.id))
        .map((d) => (
          <button key={d.id} className="mr-1 mt-1 rounded border px-1.5 hover:bg-slate-100" onClick={() => onAttach(d.id, prompt('File name on this Step', 'file.pdf') ?? 'file.pdf')}>
            {d.kind} · {d.direction} · sha {d.sha}
          </button>
        ))}
      <div className="mt-2 font-semibold">…or upload a new one</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <select className="rounded border" value={kind} onChange={(e) => setKind(e.target.value)}>
          {db.docKinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select className="rounded border" value={dir} onChange={(e) => setDir(e.target.value as 'Sent')}>
          <option>Sent</option>
          <option>Received</option>
        </select>
        <input
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            // Real app: hash the bytes; same bytes => existing Document is reused. The Document is stored now; attaching waits for ✓.
            const id = 'd-' + uid()
            write('upload Document', (d) => d.docs.push({ id, sha: uid() + '…' + uid().slice(0, 3), kind, direction: dir }))
            onAttach(id, f.name)
            setOpen(false)
          }}
        />
        <button className="ml-auto" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    </div>
  )
}

function AddStep({ p }: { p: Process }) {
  const { db, write, nav } = useStore()
  const [kind, setKind] = useState('Screening')
  const [day, setDay] = useState('')
  const [state, setState] = useState<StepState>('Planned')
  const [suggest, setSuggest] = useState<string>()
  const open = isOpen(p)
  return (
    <div className="ml-8 mt-2 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
        <span className="text-xs font-semibold">+ Step</span>
        <select className="rounded border" value={kind} onChange={(e) => setKind(e.target.value)}>
          {db.stepKinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select className="rounded border" value={state} onChange={(e) => setState(e.target.value as StepState)}>
          {open && <option>Planned</option>}
          <option>Done</option>
        </select>
        <input type="date" className="rounded border" value={day} onChange={(e) => setDay(e.target.value)} />
        <button
          className="rounded bg-indigo-600 px-2 text-white disabled:opacity-40"
          disabled={state === 'Done' && !day}
          title={state === 'Done' && !day ? 'A Done Step needs a day' : ''}
          onClick={() => {
            const id = 's-' + uid()
            write('add Step', (d) => P(d, p.id).steps.push({ id, kind, state, day: day || undefined, participants: [], docs: [], prep: '', reflection: '', feedback: [] }), p.id)
            nav({ step: id }, true)
            if (kind === 'Offer' && p.status !== 'Offer received') setSuggest('offer')
            if (kind === 'Rejection' && open) setSuggest('reject')
            setDay('')
          }}
        >
          Add
        </button>
      </div>
      {suggest && (
        <div className="rounded bg-indigo-50 p-2 text-xs">
          {suggest === 'offer' ? 'An Offer Step was added. Set Status to Offer received?' : 'A Rejection Step was added. Close the Process as Rejected?'}{' '}
          <button
            className="ml-2 rounded bg-indigo-600 px-2 text-white"
            onClick={() => {
              write(
                'apply suggestion',
                (d) => {
                  const x = P(d, p.id)
                  if (suggest === 'offer') x.status = 'Offer received'
                  else {
                    x.outcome = 'Rejected'
                    x.status = undefined
                    x.steps.forEach((s) => s.state === 'Planned' && (s.state = 'Cancelled'))
                  }
                },
                p.id,
              )
              setSuggest(undefined)
            }}
          >
            Yes
          </button>
          <button className="ml-1 rounded border px-2" onClick={() => setSuggest(undefined)}>
            No
          </button>
        </div>
      )}
    </div>
  )
}

export function Notes({ label, value, onSave, big = false }: { label: string; value: string; onSave: (v: string) => void; big?: boolean }) {
  const [draft, setDraft] = useState<string>()
  return (
    <div className="text-sm">
      <div className={big ? `mb-1 ${T.section}` : T.label}>{label}</div>
      {draft === undefined ? (
        <button className={`mt-1 w-full whitespace-pre-wrap bg-yellow-50 text-left ${big ? 'min-h-24 rounded-xl p-4 text-sm' : 'rounded p-2 text-xs'}`} onClick={() => setDraft(value)}>
          {value || <span className="text-slate-400">click to write…</span>}
        </button>
      ) : (
        <div>
          <textarea className={`mt-1 w-full rounded border p-1 ${big ? 'text-sm' : 'text-xs'}`} rows={big ? 8 : 3} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button
            className="rounded bg-slate-800 px-2 text-xs text-white"
            onClick={() => {
              onSave(draft)
              setDraft(undefined)
            }}
          >
            Save
          </button>
          <button className="ml-1 text-xs" onClick={() => setDraft(undefined)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function Participants({ p }: { p: Process }) {
  const { db, write, nav } = useStore()
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const w = (what: string, fn: (d: Db) => void) => write(what, fn, p.id)
  const match = link ? db.persons.find((x) => x.links.includes(link.trim())) : undefined
  const free = db.persons.filter((x) => !p.participants.some((pt) => pt.personId === x.id))
  const addExisting = (personId: string) => {
    w('add Participant', (d) => P(d, p.id).participants.push({ personId, side: 'Company', parts: ['Interviewer'], decisionMaker: false }))
    setAdding(false)
    setLink('')
    setName('')
  }
  return (
    <section>
      <h3 className={`mb-3 ${T.section}`}>Participants</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {p.participants.map((pt, i) => {
          const person = db.persons.find((x) => x.id === pt.personId)!
          return (
            <Card key={pt.personId} className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar name={personName(db, pt.personId)} placeholder={!person.name} />
                <div className="min-w-0 flex-1">
                  <button className="block w-full truncate text-left font-semibold text-slate-900 hover:text-indigo-700" title={personName(db, pt.personId)} onClick={() => nav({ person: pt.personId })}>
                    {personName(db, pt.personId)}
                  </button>
                  <select
                    className="-ml-1 cursor-pointer rounded border-0 bg-transparent px-1 text-xs text-slate-500 hover:bg-slate-100"
                    value={pt.side}
                    onChange={(e) => w('edit side', (d) => (P(d, p.id).participants[i].side = e.target.value as Side))}
                  >
                    {SIDES.map((s) => (
                      <option key={s} value={s}>
                        {s === 'none' ? 'Speaks for no one' : `For the ${s}`}
                      </option>
                    ))}
                  </select>
                </div>
                <Menu
                  items={[
                    [
                      'Remove from this Process',
                      () =>
                        w('remove Participant', (d) => {
                          const x = P(d, p.id)
                          x.participants = x.participants.filter((y) => y.personId !== pt.personId)
                          x.steps.forEach((s) => (s.participants = s.participants.filter((y) => y !== pt.personId)))
                        }),
                      { danger: true },
                    ],
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {pt.parts.map((part) => (
                  <span key={part} className="group inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {part}
                    {pt.parts.length > 1 && (
                      <button className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-600" aria-label={`Remove ${part}`} onClick={() => w('remove Part', (d) => (P(d, p.id).participants[i].parts = pt.parts.filter((x) => x !== part)))}>
                        ×
                      </button>
                    )}
                  </span>
                ))}
                <AddChip
                  label="Part"
                  placeholder="Part"
                  options={db.parts.filter((x) => !pt.parts.includes(x)).map((x) => ({ id: x, name: x }))}
                  onPick={(x) => w('add Part', (d) => P(d, p.id).participants[i].parts.push(x))}
                  onNew={(x) =>
                    w('add new Part', (d) => {
                      d.parts.push(x)
                      P(d, p.id).participants[i].parts.push(x)
                    })
                  }
                />
              </div>
              <button
                className={pt.decisionMaker ? '' : 'rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-700'}
                title={pt.decisionMaker ? 'Click to unmark' : 'Has a say in whether you are hired'}
                onClick={() => w('mark Decision maker', (d) => (P(d, p.id).participants[i].decisionMaker = !pt.decisionMaker))}
              >
                {pt.decisionMaker ? <DecisionMaker /> : '⚖︎ Mark decision maker'}
              </button>
            </Card>
          )
        })}
        {!adding && (
          <button className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-700" onClick={() => setAdding(true)}>
            + Add participant
          </button>
        )}
      </div>
      {adding && (
        <Card className="mt-3 space-y-3">
          <div className="flex items-center">
            <span className={T.label}>Add participant</span>
            <button className="ml-auto text-slate-400 hover:text-slate-700" aria-label="Close" onClick={() => setAdding(false)}>
              ×
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {free.map((x) => (
              <button key={x.id} className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm hover:border-indigo-300 hover:bg-indigo-50" onClick={() => addExisting(x.id)}>
                <span className="scale-75">
                  <Avatar name={personName(db, x.id)} placeholder={!x.name} />
                </span>
                {personName(db, x.id)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="New person, or a description like “the hiring manager’s boss”" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-md border px-2 py-1.5 text-sm" placeholder="Profile link" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          {match && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              This link belongs to <b>{personName(db, match.id)}</b>
              <button className="rounded-full bg-amber-600 px-2 py-0.5 text-white" onClick={() => addExisting(match.id)}>
                Use {personName(db, match.id)}
              </button>
            </div>
          )}
          <button
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm text-white disabled:opacity-40"
            disabled={!name}
            onClick={() => {
              const id = 'p-' + uid()
              const placeholder = !/^[A-Z][a-z]+ [A-Z]/.test(name)
              w('add new Person', (d) => {
                d.persons.push({ id, ...(placeholder ? { description: name } : { name }), links: link ? [link] : [] })
                P(d, p.id).participants.push({ personId: id, side: 'Company', parts: ['Interviewer'], decisionMaker: false })
              })
              setAdding(false)
              setName('')
              setLink('')
            }}
          >
            Create person
          </button>
        </Card>
      )}
    </section>
  )
}
