// PROTOTYPE (tyey/rolegraph#13): Person view + Merge, search, editable lists.
import { useState } from 'react'
import type { Db } from './data'
import { agencyName, companyName, fmtDay, isOpen, likelyDuplicates, personName, processTitle, roleName, useStore } from './store'

export function PersonView({ id }: { id: string }) {
  const { db, write, nav } = useStore()
  const [merging, setMerging] = useState(false)
  const person = db.persons.find((x) => x.id === id)
  if (!person) return <div className="p-4 text-slate-500">That Person was Merged away.</div>
  const places = db.processes.flatMap((p) => p.participants.filter((pt) => pt.personId === id).map((pt) => ({ p, pt })))
  const sameLink = likelyDuplicates(db, id)
  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">Person</div>
      <h2 className="text-xl font-bold">{person.name ?? <span className="italic">“{person.description}”</span>}</h2>
      {!person.name && (
        <button
          className="rounded border px-2 text-xs"
          onClick={() => {
            const name = prompt('Name this placeholder')
            if (name) write('name placeholder', (d) => (d.persons.find((x) => x.id === id)!.name = name))
          }}
        >
          Name this placeholder…
        </button>
      )}
      <div className="text-xs text-slate-600">
        Profile links: <ProfileLinks links={person.links} />
      </div>
      {sameLink.length > 0 && (
        <div className="rounded bg-amber-50 p-2 text-xs">
          Shares a Profile link with <b>{sameLink.map((x) => personName(db, x.id)).join(', ')}</b>. Same human?{' '}
          <button className="rounded bg-amber-600 px-1.5 text-white" onClick={() => setMerging(true)}>
            Merge…
          </button>
          <button
            className="ml-1 rounded border border-amber-600 px-1.5 text-amber-800"
            onClick={() => write('mark not duplicates', (d) => sameLink.forEach((o) => d.notDuplicates.push([id, o.id])))}
          >
            Not the same person
          </button>
        </div>
      )}
      <table className="w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th>Process</th>
            <th>spoke for</th>
            <th>Parts</th>
            <th>Decision maker</th>
            <th>state</th>
          </tr>
        </thead>
        <tbody>
          {places.map(({ p, pt }) => (
            <tr key={p.id} className="border-t">
              <td className="py-1">
                <button className="underline" onClick={() => nav({ process: p.id, person: undefined, role: p.roleId })}>
                  {processTitle(db, p)}
                </button>
              </td>
              <td>{pt.side === 'Agency' ? `Agency (${agencyName(db, p)})` : pt.side === 'none' ? 'no one' : `${pt.side} (${companyName(db, p)})`}</td>
              <td>
                {pt.parts.join(', ')}
              </td>
              <td>{pt.decisionMaker ? <span className="font-semibold text-amber-700">⚖︎ yes</span> : <span className="text-slate-400">no</span>}</td>
              <td>{p.outcome ?? p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="rounded border px-2 text-xs" onClick={() => setMerging(true)}>
        Merge with another Person…
      </button>
      {merging && <MergePersons a={id} onDone={() => setMerging(false)} />}
    </div>
  )
}

export function MergePersons({ a, initialB, onDone }: { a: string; initialB?: string; onDone: () => void }) {
  const { db, write, nav } = useStore()
  const others = db.persons.filter((x) => x.id !== a)
  const [b, setB] = useState(initialB ?? others[0]?.id)
  const [survivor, setSurvivor] = useState(a)
  const folded = survivor === a ? b : a
  const moving = db.processes.filter((p) => p.participants.some((pt) => pt.personId === folded))
  return (
    <div className="rounded border-2 border-slate-400 bg-slate-50 p-3 text-xs">
      <div className="font-semibold">Merge two Persons</div>
      <div className="mt-1">
        {personName(db, a)} +{' '}
        <select className="rounded border" value={b} onChange={(e) => setB(e.target.value)}>
          {others.map((x) => (
            <option key={x.id} value={x.id}>
              {personName(db, x.id)}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1">
        Keep:{' '}
        {[a, b].map((x) => (
          <label key={x} className="mr-2">
            <input type="radio" checked={survivor === x} onChange={() => setSurvivor(x)} /> {personName(db, x)}
          </label>
        ))}
      </div>
      <div className="mt-1 text-slate-600">
        {personName(db, folded)} goes away; its Profile links and its Participants in {moving.length} Process(es) ({moving.map((p) => companyName(db, p)).join(', ') || '—'}) move to{' '}
        {personName(db, survivor)}. Two Participants in the same Process combine their Parts.
      </div>
      <button
        className="mt-2 rounded bg-slate-800 px-3 py-1 text-white"
        onClick={() => {
          write('merge Persons', (d) => mergePersons(d, survivor, folded!))
          nav({ person: survivor })
          onDone()
        }}
      >
        Merge
      </button>
      <button className="ml-1 rounded border px-3 py-1" onClick={onDone}>
        Cancel
      </button>
    </div>
  )
}

function mergePersons(d: Db, keep: string, fold: string) {
  const k = d.persons.find((x) => x.id === keep)!
  const f = d.persons.find((x) => x.id === fold)!
  k.links = [...new Set([...k.links, ...f.links])]
  k.name ??= f.name
  d.persons = d.persons.filter((x) => x !== f)
  d.notDuplicates = d.notDuplicates.map(([a, b]) => [a === fold ? keep : a, b === fold ? keep : b] as [string, string]).filter(([a, b]) => a !== b)
  for (const p of d.processes) {
    const fp = p.participants.find((x) => x.personId === fold)
    if (fp) {
      const kp = p.participants.find((x) => x.personId === keep)
      if (kp) {
        kp.parts = [...new Set([...kp.parts, ...fp.parts])]
        kp.decisionMaker ||= fp.decisionMaker
        p.participants = p.participants.filter((x) => x !== fp)
      } else fp.personId = keep
    }
    for (const s of p.steps) {
      s.participants = [...new Set(s.participants.map((x) => (x === fold ? keep : x)))]
      s.feedback.forEach((fb) => fb.participantPersonId === fold && (fb.participantPersonId = keep))
    }
  }
}

// ---- search (FTS5 in the real app) ----
type Hit = { kind: string; text: string; processId?: string; personId?: string; roleId?: string; stepId?: string }
export function searchDb(db: Db, q: string): Hit[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const hits: Hit[] = []
  const has = (s?: string) => !!s && s.toLowerCase().includes(needle)
  db.roles.forEach((r) => has(r.name) && hits.push({ kind: 'Role', text: r.name, roleId: r.id }))
  db.persons.forEach((x) => has(x.name ?? x.description) && hits.push({ kind: 'Person', text: personName(db, x.id), personId: x.id }))
  db.companies.forEach((c) => {
    if (has(c.name) || c.aliases.some(has))
      db.processes.filter((p) => p.companyId === c.id).forEach((p) => hits.push({ kind: 'Company', text: `${c.name}${c.aliases.length ? ` (aka ${c.aliases.join(', ')})` : ''}`, processId: p.id }))
  })
  db.agencies.forEach((a) => has(a.name) && db.processes.filter((p) => p.agencyId === a.id).forEach((p) => hits.push({ kind: 'Agency', text: a.name, processId: p.id })))
  db.processes.forEach((p) => {
    if (has(p.prep)) hits.push({ kind: 'Process prep notes', text: p.prep, processId: p.id })
    p.steps.forEach((s) => {
      if (has(s.prep)) hits.push({ kind: 'Step prep notes', text: s.prep, processId: p.id, stepId: s.id })
      if (has(s.reflection)) hits.push({ kind: 'Reflection', text: s.reflection, processId: p.id, stepId: s.id })
      s.feedback.forEach((f) => has(f.text) && hits.push({ kind: 'Feedback', text: f.text, processId: p.id, stepId: s.id }))
    })
  })
  return hits
}

const snippet = (text: string, q: string) => {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  const a = Math.max(0, i - 30)
  return (
    <>
      {a > 0 && '…'}
      {text.slice(a, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length, i + q.length + 50)}…
    </>
  )
}

export function SearchBox({ className = '' }: { className?: string }) {
  const { search, nav } = useStore()
  return (
    <label className={`relative block ${className}`}>
      <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder="Search"
        aria-label="Search notes, Feedback, People, Companies and Roles"
        value={search.q ?? ''}
        onChange={(e) => nav({ q: e.target.value }, true)}
      />
    </label>
  )
}

export function SearchResults({ onPick }: { onPick?: () => void }) {
  const { db, search, nav } = useStore()
  const q = search.q ?? ''
  const hits = searchDb(db, q)
  return (
    <div className="divide-y text-sm">
      <div className="pb-1 text-xs text-slate-500">
        {hits.length} hit{hits.length !== 1 && 's'} for “{q}”
      </div>
      {hits.map((h, i) => {
        const p = db.processes.find((x) => x.id === h.processId)
        return (
          <button
            key={i}
            className="block w-full py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              if (h.personId) nav({ person: h.personId, q: undefined })
              else if (h.roleId) nav({ role: h.roleId, q: undefined })
              else nav({ process: h.processId, role: p?.roleId, step: h.stepId, person: undefined, q: undefined })
              onPick?.()
            }}
          >
            <span className="mr-2 rounded bg-slate-100 px-1.5 text-xs">{h.kind}</span>
            <span className="text-xs">{snippet(h.text, q)}</span>
            {p && <div className="text-xs text-slate-500">in {processTitle(db, p)}</div>}
          </button>
        )
      })}
    </div>
  )
}

export function ProcessList({ roleIds, includeClosed = true }: { roleIds: string[]; includeClosed?: boolean }) {
  const { db, search, nav } = useStore()
  const ps = db.processes.filter((p) => roleIds.includes(p.roleId) && (includeClosed || isOpen(p)))
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-slate-500">
        <tr>
          <th className="py-1">Company</th>
          <th>Role</th>
          <th>State</th>
          <th>Next</th>
        </tr>
      </thead>
      <tbody>
        {ps.map((p) => {
          const next = p.steps.find((s) => s.state === 'Planned')
          return (
            <tr key={p.id} className={`cursor-pointer border-t hover:bg-slate-50 ${search.process === p.id ? 'bg-indigo-50' : ''} ${isOpen(p) ? '' : 'text-slate-400'}`} onClick={() => nav({ process: p.id, person: undefined, step: undefined, tab: undefined })}>
              <td className="py-1.5">
                {companyName(db, p)}
                {p.agencyId && <span className="text-xs text-slate-400"> via {agencyName(db, p)}</span>}
              </td>
              <td className="text-xs">{roleName(db, p.roleId)}</td>
              <td className="text-xs">{p.outcome ?? p.status}</td>
              <td className="text-xs">{next ? `${next.kind} · ${fmtDay(next.day)}` : '—'}</td>
            </tr>
          )
        })}
        {ps.length === 0 && (
          <tr>
            <td className="py-2 text-xs text-slate-400" colSpan={4}>
              No Processes here.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

type ListKey = 'stepKinds' | 'channels' | 'docKinds' | 'parts'
export function ListsPanel() {
  const { db, write } = useStore()
  const [key, setKey] = useState<ListKey>('stepKinds')
  const labels: Record<ListKey, string> = { stepKinds: 'Step kinds', channels: 'Channels', docKinds: 'Document kinds', parts: 'Parts' }
  return (
    <div className="space-y-2 p-4 text-sm">
      <div className="flex gap-1">
        {(Object.keys(labels) as ListKey[]).map((k) => (
          <button key={k} className={`rounded px-2 text-xs ${k === key ? 'bg-slate-800 text-white' : 'border'}`} onClick={() => setKey(k)}>
            {labels[k]}
          </button>
        ))}
      </div>
      {db[key].map((item) => (
        <div key={item} className="flex items-center gap-2 border-t py-1 text-xs">
          <span className="flex-1">{item}</span>
          <button
            onClick={() => {
              const n = prompt('Rename', item)
              if (n) write('rename', (d) => (d[key] = d[key].map((x) => (x === item ? n : x))))
            }}
          >
            rename
          </button>
          <select
            className="rounded border"
            value=""
            onChange={(e) => {
              const into = e.target.value
              write('merge list item', (d) => {
                d[key] = d[key].filter((x) => x !== item)
                // Real app moves every reference; the prototype just renames them.
                d.processes.forEach((p) =>
                  p.steps.forEach((s) => {
                    if (key === 'stepKinds' && s.kind === item) s.kind = into
                    if (key === 'channels' && s.channel === item) s.channel = into
                  }),
                )
              })
            }}
          >
            <option value="">merge into…</option>
            {db[key]
              .filter((x) => x !== item)
              .map((x) => (
                <option key={x}>{x}</option>
              ))}
          </select>
        </div>
      ))}
      <button
        className="rounded border px-2 text-xs"
        onClick={() => {
          const n = prompt(`New ${labels[key]} entry`)
          if (n) write('add list item', (d) => d[key].push(n))
        }}
      >
        + add
      </button>
    </div>
  )
}

/** One row per Person × organisation they spoke for (a recruiter seen at two Companies gets two rows). */
export function PeopleList() {
  const { db, nav, search, write } = useStore()
  const [picked, setPicked] = useState<string[]>([])
  const [org, setOrg] = useState('')
  const dupOf = (id: string) => likelyDuplicates(db, id)
  type Row = { personId: string; org: string; side: string; parts: Set<string>; dm: boolean; processes: number }
  const rows: Row[] = []
  for (const x of db.persons) {
    const mine = new Map<string, Row>()
    for (const p of db.processes)
      for (const pt of p.participants.filter((y) => y.personId === x.id)) {
        const o = pt.side === 'Agency' ? (agencyName(db, p) ?? '?') : pt.side === 'none' ? '' : companyName(db, p)
        const r = mine.get(o) ?? { personId: x.id, org: o, side: pt.side, parts: new Set<string>(), dm: false, processes: 0 }
        pt.parts.forEach((t) => r.parts.add(t))
        r.dm ||= pt.decisionMaker
        r.processes++
        mine.set(o, r)
      }
    rows.push(...(mine.size ? mine.values() : [{ personId: x.id, org: '', side: 'none', parts: new Set<string>(), dm: false, processes: 0 }]))
  }
  const orgs = [...new Set(rows.map((r) => r.org).filter(Boolean))].sort()
  const shown = rows
    .filter((r) => !org || r.org === org)
    .sort((a, b) => (a.org || '￿').localeCompare(b.org || '￿') || personName(db, a.personId).localeCompare(personName(db, b.personId)))
  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">People</h2>
        <select className="rounded border text-xs" value={org} onChange={(e) => setOrg(e.target.value)}>
          <option value="">All Companies & Agencies</option>
          {orgs.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">Tick two to Merge them.</span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="w-6" />
            <th>Person</th>
            <th>Company / Agency</th>
            <th>Parts</th>
            <th>Decision maker</th>
            <th>Processes</th>
            <th>Profile links</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const x = db.persons.find((y) => y.id === r.personId)!
            const dups = dupOf(x.id)
            return (
              <tr key={x.id + r.org} className={`border-t ${search.person === x.id ? 'bg-indigo-100' : dups.length ? 'bg-amber-50' : ''}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={picked.includes(x.id)}
                    disabled={!picked.includes(x.id) && picked.length >= 2}
                    onChange={(e) => setPicked((ps) => (e.target.checked ? [...ps, x.id] : ps.filter((i) => i !== x.id)))}
                  />
                </td>
                <td className="py-1">
                  <button className="underline" onClick={() => nav({ person: x.id, tab: undefined })}>
                    {personName(db, x.id)}
                  </button>
                  {!x.name && <span className="ml-1 rounded bg-slate-200 px-1 text-[10px]">placeholder</span>}
                </td>
                <td>
                  {r.org || <span className="text-slate-400">— no one</span>}
                  {r.side !== 'Company' && r.org && <span className="ml-1 text-[10px] text-slate-400">{r.side}</span>}
                </td>
                <td>
                  {[...r.parts].join(', ') || '—'}
                </td>
                <td>{r.dm ? <span className="font-semibold text-amber-700">⚖︎ yes</span> : <span className="text-slate-400">no</span>}</td>
                <td>{r.processes}</td>
                <td>
                  <ProfileLinks links={x.links} />
                </td>
                <td className="text-amber-700">
                  {dups.length > 0 && (
                    <>
                      possible duplicate of {dups.map((d) => personName(db, d.id)).join(', ')}
                      <button
                        className="ml-1 rounded border border-amber-600 px-1 text-[10px]"
                        onClick={() => write('mark not duplicates', (d) => dups.forEach((o) => d.notDuplicates.push([x.id, o.id])))}
                      >
                        not the same
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {picked.length === 2 && <MergePersons a={picked[0]} initialB={picked[1]} onDone={() => setPicked([])} />}
    </div>
  )
}

/** Profile links always open outside rolegraph, in a new tab. */
export function ProfileLinks({ links }: { links: string[] }) {
  if (!links.length) return <span className="text-slate-400">none</span>
  return (
    <>
      {links.map((l, i) => (
        <span key={l}>
          {i > 0 && ', '}
          <a className="text-indigo-700 underline" href={l.includes('@') ? `mailto:${l}` : `https://${l}`} target="_blank" rel="noopener noreferrer">
            {l} ↗
          </a>
        </span>
      ))}
    </>
  )
}
