// PROTOTYPE (tyey/rolegraph#13): a Process with its Participants and Timeline.
import { useState } from 'react'
import type { Db, Outcome, Process, Side, Status, Step, StepState } from './data'
import { agencyName, companyName, fields, fmtDay, isOpen, personName, roleName, timeline, uid, useStore } from './store'

const STATUSES: Status[] = ['Active', 'On hold', 'Offer received']
const OUTCOMES: Outcome[] = ['Accepted', 'Declined', 'Rejected', 'Withdrawn', 'Ghosted']
const SIDES: Side[] = ['Company', 'Talent team', 'Agency', 'none']
const stateStyle: Record<StepState, string> = {
  Done: 'border-emerald-500 bg-emerald-500',
  Planned: 'border-sky-500 bg-white',
  Cancelled: 'border-slate-300 bg-slate-200',
}

const P = (d: Db, id: string) => d.processes.find((p) => p.id === id)!
const S = (d: Db, pid: string, sid: string) => P(d, pid).steps.find((s) => s.id === sid)!

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
          <thead className="text-left text-slate-500">
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
                    {r.clash && <div className="text-[10px] font-semibold text-amber-700">both changed</div>}
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

export function ProcessPanel({ id, wide = false }: { id: string; wide?: boolean }) {
  const { db, write, nav, search } = useStore()
  const p = db.processes.find((x) => x.id === id)
  const [closing, setClosing] = useState(false)
  if (!p) return <div className="p-4 text-slate-500">Pick a Process.</div>
  const w = (what: string, fn: (d: Db) => void) => write(what, fn, p.id)
  const agency = agencyName(db, p)

  return (
    <div className="space-y-4 p-4">
      <header>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          <button className="underline" onClick={() => nav({ role: p.roleId })}>
            {roleName(db, p.roleId)}
          </button>
          {agency && <> · via Agency {agency}</>} · v{p.version}
        </div>
        <h2 className="text-xl font-bold">{companyName(db, p)}</h2>
        {!p.companyId && <div className="text-xs text-amber-700">The Agency hasn’t named the Company yet.</div>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {isOpen(p) ? (
            <>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">Open</span>
              <select className="rounded border px-1" value={p.status} onChange={(e) => w('change Status', (d) => (P(d, p.id).status = e.target.value as Status))}>
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button className="rounded border px-2" onClick={() => setClosing(true)}>
                Close…
              </button>
            </>
          ) : (
            <>
              <span className="rounded bg-slate-200 px-2 py-0.5">Closed · {p.outcome}</span>
              <button
                className="rounded border px-2"
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
          <label className="ml-auto text-xs text-slate-500">
            Reclassify to{' '}
            <select className="rounded border" value={p.roleId} onChange={(e) => w('reclassify', (d) => (P(d, p.id).roleId = e.target.value))}>
              {db.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {closing && <CloseDialog p={p} onDone={() => setClosing(false)} />}

      {wide ? (
        // Layout C: full-width stack, prep notes → Participants → Timeline.
        <div className="space-y-6">
          <Notes big label="Process prep notes" value={p.prep} onSave={(v) => w('edit Process prep notes', (d) => (P(d, p.id).prep = v))} />
          <Participants p={p} />
          <section>
            <h3 className="mb-2 font-semibold">Timeline</h3>
            <Timeline p={p} openStep={search.step} />
            <AddStep p={p} />
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 font-semibold">Timeline</h3>
            <Timeline p={p} openStep={search.step} />
            <AddStep p={p} />
          </section>
          <Notes label="Process prep notes" value={p.prep} onSave={(v) => w('edit Process prep notes', (d) => (P(d, p.id).prep = v))} />
          <Participants p={p} />
        </div>
      )}
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
    <div className="rounded border-2 border-slate-400 bg-slate-50 p-3 text-sm">
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
              className={`rounded border bg-white p-2 ${s.state === 'Cancelled' ? 'opacity-50' : ''} ${openStep === s.id ? 'ring-2 ring-indigo-400' : 'cursor-pointer hover:border-indigo-300'}`}
              onClick={() => openStep !== s.id && nav({ step: s.id }, true)}
            >
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
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

function StepDetail({ p, s }: { p: Process; s: Step }) {
  const { db, write, nav } = useStore()
  const w = (what: string, fn: (st: Step) => void) => write(what, (d) => fn(S(d, p.id, s.id)), p.id)
  const [fb, setFb] = useState('')
  const [fbBy, setFbBy] = useState('')
  return (
    <div className="mt-2 space-y-3 border-t pt-2 text-sm">
      <button className="float-right rounded bg-slate-800 px-2 text-xs text-white" onClick={() => nav({ step: undefined }, true)}>
        Done editing
      </button>
      <div className="flex flex-wrap gap-2">
        {(['Planned', 'Done', 'Cancelled'] as StepState[]).map((st) => (
          <button
            key={st}
            disabled={st === 'Planned' && !isOpen(p)}
            className={`rounded border px-2 text-xs disabled:opacity-30 ${s.state === st ? 'bg-slate-800 text-white' : ''}`}
            onClick={() => w(`mark ${st}`, (x) => (x.state = st))}
          >
            {st}
          </button>
        ))}
        <input type="date" className="rounded border px-1 text-xs" value={s.day ?? ''} onChange={(e) => w('reschedule', (x) => (x.day = e.target.value || undefined))} />
        <input type="time" className="rounded border px-1 text-xs" value={s.time ?? ''} onChange={(e) => w('set time', (x) => (x.time = e.target.value || undefined))} />
        <label className="text-xs">
          end <input type="date" className="rounded border px-1" value={s.endDay ?? ''} onChange={(e) => w('set end', (x) => (x.endDay = e.target.value || undefined))} />
        </label>
      </div>
      <div className="text-xs">
        <span className="font-semibold">Took part: </span>
        {p.participants.length === 0 && <span className="text-slate-400">no Participants on this Process yet</span>}
        {p.participants.map((pt) => (
          <label key={pt.personId} className="mr-2">
            <input
              type="checkbox"
              checked={s.participants.includes(pt.personId)}
              onChange={(e) => w('edit Step participants', (x) => (x.participants = e.target.checked ? [...x.participants, pt.personId] : x.participants.filter((i) => i !== pt.personId)))}
            />{' '}
            {personName(db, pt.personId)}
          </label>
        ))}
      </div>
      <AttachDoc p={p} s={s} />
      <Notes label="Step prep notes" value={s.prep} onSave={(v) => w('edit Step prep notes', (x) => (x.prep = v))} />
      <Notes label="Reflection (yours, one per Step)" value={s.reflection} onSave={(v) => w('edit Reflection', (x) => (x.reflection = v))} />
      <div>
        <div className="text-xs font-semibold">Feedback</div>
        {s.feedback.map((f, i) => (
          <div key={i} className="mt-1 rounded bg-slate-50 p-1 text-xs">
            <span className="text-slate-500">
              {fmtDay(f.day)} · {f.participantPersonId ? personName(db, f.participantPersonId) : (f.fromSide ?? 'unknown')}:
            </span>{' '}
            {f.text}
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
              w('add Feedback', (x) =>
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

function AttachDoc({ p, s }: { p: Process; s: Step }) {
  const { db, write } = useStore()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(db.docKinds[0])
  const [dir, setDir] = useState<'Sent' | 'Received'>('Sent')
  const attach = (docId: string, fileName: string) => write('attach Document', (d) => S(d, p.id, s.id).docs.push({ docId, fileName }), p.id)
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
        .filter((d) => !s.docs.some((x) => x.docId === d.id))
        .map((d) => (
          <button key={d.id} className="mr-1 mt-1 rounded border px-1.5 hover:bg-slate-100" onClick={() => attach(d.id, prompt('File name on this Step', 'file.pdf') ?? 'file.pdf')}>
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
            // Real app: hash the bytes; same bytes => existing Document is reused.
            const id = 'd-' + uid()
            write(
              'upload Document',
              (d) => {
                d.docs.push({ id, sha: uid() + '…' + uid().slice(0, 3), kind, direction: dir })
                S(d, p.id, s.id).docs.push({ docId: id, fileName: f.name })
              },
              p.id,
            )
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
      <div className="flex flex-wrap items-center gap-1 rounded border border-dashed p-2">
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
      <div className="text-xs font-semibold">{label}</div>
      {draft === undefined ? (
        <button className={`mt-1 w-full whitespace-pre-wrap rounded bg-yellow-50 p-2 text-left ${big ? 'min-h-24 text-sm' : 'text-xs'}`} onClick={() => setDraft(value)}>
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
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold">Participants</div>
      <table className="mt-1 w-full text-xs">
        <thead className="text-left text-[10px] uppercase text-slate-400">
          <tr>
            <th>Person</th>
            <th>speaks for</th>
            <th>Parts</th>
            <th>Decision maker</th>
          </tr>
        </thead>
        <tbody>
          {p.participants.map((pt, i) => (
            <tr key={pt.personId} className="border-t align-top">
              <td className="py-1">
                <button className="underline" onClick={() => nav({ person: pt.personId })}>
                  {personName(db, pt.personId)}
                </button>
              </td>
              <td>
                <select className="rounded border" value={pt.side} onChange={(e) => w('edit side', (d) => (P(d, p.id).participants[i].side = e.target.value as Side))}>
                  {SIDES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'none' ? 'speaks for no one' : `for ${s}`}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {pt.parts.join(', ')}
                <select
                  className="ml-1 w-5 rounded border"
                  value=""
                  title="add a Part"
                  onChange={(e) => w('add Part', (d) => P(d, p.id).participants[i].parts.push(e.target.value))}
                >
                  <option value="">+</option>
                  {db.parts
                    .filter((x) => !pt.parts.includes(x))
                    .map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                </select>
              </td>
              <td>
                <label title="Has a say in whether you are hired" className="flex items-center gap-1">
                  <input type="checkbox" checked={pt.decisionMaker} onChange={(e) => w('mark Decision maker', (d) => (P(d, p.id).participants[i].decisionMaker = e.target.checked))} />
                  {pt.decisionMaker && <span className="text-amber-700">⚖︎ yes</span>}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!adding ? (
        <button className="mt-1 rounded border px-2 text-xs" onClick={() => setAdding(true)}>
          + Participant
        </button>
      ) : (
        <div className="mt-1 space-y-1 rounded border p-2 text-xs">
          <div>Existing Person:</div>
          {free.map((x) => (
            <button
              key={x.id}
              className="mr-1 rounded bg-slate-100 px-1.5"
              onClick={() => {
                w('add Participant', (d) => P(d, p.id).participants.push({ personId: x.id, side: 'Company', parts: ['Interviewer'], decisionMaker: false }))
                setAdding(false)
              }}
            >
              {personName(db, x.id)}
            </button>
          ))}
          <div className="pt-1">…or a new Person (name or placeholder description, plus a Profile link):</div>
          <input className="w-full rounded border px-1" placeholder="Name, or e.g. “the hiring manager’s boss”" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded border px-1" placeholder="Profile link (try linkedin.example/in/mirasol)" value={link} onChange={(e) => setLink(e.target.value)} />
          {match && (
            <div className="rounded bg-amber-50 p-1">
              That Profile link already belongs to <b>{personName(db, match.id)}</b>. Same human?{' '}
              <button
                className="rounded bg-amber-600 px-1.5 text-white"
                onClick={() => {
                  w('add Participant', (d) => P(d, p.id).participants.push({ personId: match.id, side: 'Company', parts: ['Interviewer'], decisionMaker: false }))
                  setAdding(false)
                  setLink('')
                }}
              >
                Use {personName(db, match.id)}
              </button>{' '}
              or create a separate Person anyway ↓
            </div>
          )}
          <button
            className="rounded bg-indigo-600 px-2 text-white disabled:opacity-40"
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
            Create Person
          </button>
          <button className="ml-1" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
