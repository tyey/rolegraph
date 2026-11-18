// PROTOTYPE (tyey/rolegraph#13): Person view + Merge, search, editable lists.
import { useEffect, useRef, useState } from 'react'
import type { Db } from './data'
import { agencyName, companyName, DecisionMaker, StatePill, fmtDay, isOpen, likelyDuplicates, personName, processTitle, roleName, useStore } from './store'
import { ProcessCard } from './role'
import { AddChip, Avatar, Card, Icon, Menu, Segmented, Stat, T } from './ui'

export function PersonView({ id }: { id: string }) {
  const { db, write } = useStore()
  const [merging, setMerging] = useState(false)
  const [naming, setNaming] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  useEffect(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), [id]) // the pane sits below the People list
  const person = db.persons.find((x) => x.id === id)
  if (!person) return <div className="p-6 text-slate-400">That Person was Merged away.</div>
  const places = db.processes.flatMap((p) => p.participants.filter((pt) => pt.personId === id).map((pt) => ({ p, pt })))
  const sameLink = likelyDuplicates(db, id)
  const orgs = new Set(places.map(({ p, pt }) => (pt.side === 'Agency' ? agencyName(db, p) : pt.side === 'none' ? '' : companyName(db, p))).filter(Boolean))
  return (
    <div ref={top} className="mx-auto max-w-5xl scroll-mt-4 space-y-8 p-6">
      <header className="flex items-start gap-4">
        <span className="scale-125">
          <Avatar name={personName(db, id)} placeholder={!person.name} />
        </span>
        <div className="flex-1">
          {naming ? (
            <input
              autoFocus
              placeholder="Their name"
              defaultValue={person.name ?? ''}
              className={`${T.page} w-full rounded border border-indigo-300 px-1`}
              onBlur={(e) => {
                const n = e.target.value.trim()
                if (n) write('name Person', (d) => (d.persons.find((x) => x.id === id)!.name = n))
                setNaming(false)
              }}
              onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setNaming(false))}
            />
          ) : (
            <h2 className={`${T.page} group flex items-center gap-2`}>
              {person.name ?? <span className="italic text-slate-500">“{person.description}”</span>}
              <button className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-slate-600" title={person.name ? 'Rename' : 'Name this placeholder'} aria-label="Rename" onClick={() => setNaming(true)}>
                <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </button>
            </h2>
          )}
          {!person.name && <div className="mt-0.5 text-xs text-slate-500">Placeholder</div>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <ProfileLinks links={person.links} />
          </div>
        </div>
        <Menu items={[['Merge with another person…', () => setMerging(true)]]} />
      </header>

      {sameLink.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Same person as <b>{sameLink.map((x) => personName(db, x.id)).join(', ')}</b>? They share a Profile link.
          <span className="ml-auto flex gap-2">
            <button className="rounded-full bg-amber-600 px-3 py-1 text-xs text-white" onClick={() => setMerging(true)}>
              Merge
            </button>
            <button className="rounded-full border border-amber-400 px-3 py-1 text-xs" onClick={() => write('mark not duplicates', (d) => sameLink.forEach((o) => d.notDuplicates.push([id, o.id])))}>
              Not the same
            </button>
          </span>
        </div>
      )}
      {merging && <MergePersons a={id} initialB={sameLink[0]?.id} onDone={() => setMerging(false)} />}

      <div className="grid grid-cols-3 gap-3">
        <Stat n={places.length} label="Processes" />
        <Stat n={orgs.size} label="Companies and Agencies" />
        <Stat n={places.filter(({ pt }) => pt.decisionMaker).length} label="Decision maker in" />
      </div>

      <section>
        <h3 className={`mb-3 ${T.section}`}>Processes</h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {places.map(({ p, pt }) => (
            <ProcessCard key={p.id} p={p} showRole>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-3">
                <span className="text-xs text-slate-500">{pt.side === 'none' ? 'For no one' : `For the ${pt.side}`}</span>
                {pt.parts.map((x) => (
                  <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {x}
                  </span>
                ))}
                {pt.decisionMaker && <DecisionMaker />}
              </div>
            </ProcessCard>
          ))}
        </div>
      </section>
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
    <Card className="space-y-4 shadow-sm">
      <div className="flex items-center">
        <span className={T.section}>Merge two people</span>
        <button className="ml-auto text-slate-400 hover:text-slate-700" aria-label="Close" onClick={onDone}>
          ×
        </button>
      </div>
      {!initialB && (
        <div className="flex flex-wrap gap-2">
          {others.map((x) => (
            <button key={x.id} className={`rounded-full border px-3 py-1 text-sm ${b === x.id ? 'border-indigo-400 bg-indigo-50' : 'hover:bg-slate-50'}`} onClick={() => setB(x.id)}>
              {personName(db, x.id)}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((x) => (
          <button key={x} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${survivor === x ? 'border-indigo-400 bg-indigo-50' : 'opacity-60 hover:opacity-100'}`} onClick={() => setSurvivor(x)}>
            <Avatar name={personName(db, x)} placeholder={!db.persons.find((y) => y.id === x)?.name} />
            <span className="flex-1">
              <span className="block font-medium">{personName(db, x)}</span>
              <span className="text-xs text-slate-500">{survivor === x ? 'Keep' : 'Fold in'}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        {moving.length} Process{moving.length !== 1 && 'es'} move{moving.length === 1 && 's'} over{moving.length > 0 && `: ${moving.map((p) => companyName(db, p)).join(', ')}`}
      </div>
      <button
        className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm text-white"
        onClick={() => {
          write('merge Persons', (d) => mergePersons(d, survivor, folded!))
          nav({ person: survivor })
          onDone()
        }}
      >
        Merge into {personName(db, survivor)}
      </button>
    </Card>
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
  const kinds = [...new Set(hits.map((h) => h.kind))]
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className={T.page}>Search</h2>
        <div className="text-xs text-slate-500">{q ? `${hits.length} result${hits.length !== 1 ? 's' : ''} for “${q}”` : 'Type in the search box'}</div>
      </div>
      {kinds.map((k) => (
        <section key={k}>
          <h3 className={`mb-2 ${T.eyebrow}`}>{k}</h3>
          <div className="grid gap-2">
            {hits
              .filter((h) => h.kind === k)
              .map((h, i) => {
                const p = db.processes.find((x) => x.id === h.processId)
                return (
                  <button
                    key={i}
                    className="rounded-xl border bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-sm"
                    onClick={() => {
                      if (h.personId) nav({ person: h.personId, q: undefined, tab: undefined })
                      else if (h.roleId) nav({ role: h.roleId, q: undefined, tab: 'role' })
                      else nav({ process: h.processId, role: p?.roleId, step: h.stepId, person: undefined, q: undefined, tab: undefined })
                      onPick?.()
                    }}
                  >
                    <div className="text-sm text-slate-800">{snippet(h.text, q)}</div>
                    {p && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        {processTitle(db, p)} <StatePill p={p} />
                      </div>
                    )}
                  </button>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function ProcessList({ roleIds, includeClosed = true }: { roleIds: string[]; includeClosed?: boolean }) {
  const { db, search, nav } = useStore()
  const ps = db.processes.filter((p) => roleIds.includes(p.roleId) && (includeClosed || isOpen(p)))
  return (
    <table className={T.table}>
      <thead className={T.thead}>
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
              <td>{roleName(db, p.roleId)}</td>
              <td>
                <StatePill p={p} />
              </td>
              <td>{next ? `${next.kind} · ${fmtDay(next.day)}` : '—'}</td>
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
  const [renaming, setRenaming] = useState<string>()
  const [merging, setMerging] = useState<string>()
  const labels: Record<ListKey, string> = { stepKinds: 'Step kinds', channels: 'Channels', docKinds: 'Document kinds', parts: 'Parts' }
  const steps = db.processes.flatMap((p) => p.steps)
  const uses = (item: string) =>
    key === 'stepKinds'
      ? steps.filter((s) => s.kind === item).length
      : key === 'channels'
        ? steps.filter((s) => s.channel === item).length
        : key === 'docKinds'
          ? db.docs.filter((d) => d.kind === item).length
          : db.processes.flatMap((p) => p.participants).filter((pt) => pt.parts.includes(item)).length
  const mergeInto = (item: string, into: string) =>
    write('merge list item', (d) => {
      d[key] = d[key].filter((x) => x !== item)
      d.processes.forEach((p) => {
        p.steps.forEach((s) => {
          if (key === 'stepKinds' && s.kind === item) s.kind = into
          if (key === 'channels' && s.channel === item) s.channel = into
        })
        if (key === 'parts') p.participants.forEach((pt) => (pt.parts = [...new Set(pt.parts.map((x) => (x === item ? into : x)))]))
      })
      if (key === 'docKinds') d.docs.forEach((doc) => doc.kind === item && (doc.kind = into))
    })
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className={T.page}>Lists</h2>
        <Segmented value={key} options={Object.entries(labels) as [ListKey, string][]} onChange={(k) => (setKey(k), setMerging(undefined))} />
      </div>
      {merging && (
        <Card>
          <div className="mb-2 flex items-center">
            <span className={T.label}>Merge “{merging}” into</span>
            <button className="ml-auto text-slate-400 hover:text-slate-700" aria-label="Close" onClick={() => setMerging(undefined)}>
              ×
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {db[key]
              .filter((x) => x !== merging)
              .map((x) => (
                <button key={x} className="rounded-full border px-3 py-1 text-sm hover:border-indigo-300 hover:bg-indigo-50" onClick={() => (mergeInto(merging, x), setMerging(undefined))}>
                  {x}
                </button>
              ))}
          </div>
        </Card>
      )}
      <div className="divide-y rounded-xl border bg-white">
        {db[key].map((item) => (
          <div key={item} className="group flex items-center gap-3 px-4 py-2">
            {renaming === item ? (
              <input
                autoFocus
                defaultValue={item}
                className="flex-1 rounded border border-indigo-300 px-2 py-0.5"
                onBlur={(e) => {
                  const n = e.target.value.trim()
                  if (n && n !== item) write('rename', (d) => (d[key] = d[key].map((x) => (x === item ? n : x))))
                  setRenaming(undefined)
                }}
                onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setRenaming(undefined))}
              />
            ) : (
              <span className="flex flex-1 items-center gap-2 font-medium text-slate-800">
                {item}
                <button className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600" aria-label="Rename" title="Rename" onClick={() => setRenaming(item)}>
                  <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" size={14} />
                </button>
              </span>
            )}
            <span className="text-xs text-slate-400">{uses(item)} in use</span>
            <Menu items={[['Merge into…', () => setMerging(item)]]} />
          </div>
        ))}
        <div className="px-4 py-2.5">
          <AddChip label="Add" placeholder="Name" options={[]} onPick={() => {}} onNew={(n) => write('add list item', (d) => d[key].push(n))} />
        </div>
      </div>
    </div>
  )
}

/** People grouped by the Company or Agency they spoke for; a Person seen at two organisations appears in both groups. */
export function PeopleList() {
  const { db, nav, search, write } = useStore()
  const [picked, setPicked] = useState<string[]>([])
  const [org, setOrg] = useState('')
  const [mergePair, setMergePair] = useState<[string, string]>()
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
  const orgs = [...new Set(rows.map((r) => r.org))].sort((a, b) => (a || '\uffff').localeCompare(b || '\uffff'))
  const pairs = db.persons.flatMap((x) => likelyDuplicates(db, x.id).filter((o) => o.id > x.id).map((o) => [x.id, o.id] as [string, string]))
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={T.page}>People</h2>
        <span className="text-xs text-slate-500">{db.persons.length}</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {['', ...orgs.filter(Boolean)].map((o) => (
            <button key={o || 'all'} className={`rounded-full px-3 py-1 text-xs ${org === o ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} onClick={() => setOrg(o)}>
              {o || 'All'}
            </button>
          ))}
        </div>
      </div>

      {pairs.map(([a, b]) => (
        <div key={a + b} className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <b>{personName(db, a)}</b> and <b>{personName(db, b)}</b> share a Profile link. Same person?
          <span className="ml-auto flex gap-2">
            <button className="rounded-full bg-amber-600 px-3 py-1 text-xs text-white" onClick={() => setMergePair([a, b])}>
              Merge
            </button>
            <button className="rounded-full border border-amber-400 px-3 py-1 text-xs" onClick={() => write('mark not duplicates', (d) => d.notDuplicates.push([a, b]))}>
              Not the same
            </button>
          </span>
        </div>
      ))}
      {mergePair && <MergePersons a={mergePair[0]} initialB={mergePair[1]} onDone={() => setMergePair(undefined)} />}
      {picked.length === 2 && <MergePersons a={picked[0]} initialB={picked[1]} onDone={() => setPicked([])} />}

      {orgs
        .filter((o) => !org || o === org)
        .map((o) => {
          const group = rows.filter((r) => r.org === o).sort((a, b) => personName(db, a.personId).localeCompare(personName(db, b.personId)))
          return (
            <section key={o || 'none'}>
              <h3 className={`mb-2 ${T.eyebrow}`}>{o || 'Spoke for no one'}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {group.map((r) => {
                  const x = db.persons.find((y) => y.id === r.personId)!
                  const on = picked.includes(x.id)
                  return (
                    <div
                      key={x.id}
                      role="button"
                      tabIndex={0}
                      className={`group relative cursor-pointer rounded-xl border bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm ${search.person === x.id ? 'border-indigo-400 ring-2 ring-indigo-100' : ''}`}
                      onClick={() => nav({ person: x.id, tab: undefined })}
                    >
                      <input
                        type="checkbox"
                        title="Select to merge"
                        className={`absolute right-3 top-3 ${on ? '' : 'opacity-0 group-hover:opacity-100'}`}
                        checked={on}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setPicked((ps) => (e.target.checked ? [...ps, x.id].slice(-2) : ps.filter((i) => i !== x.id)))}
                      />
                      <div className="flex items-center gap-3 pr-5">
                        <Avatar name={personName(db, x.id)} placeholder={!x.name} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900" title={personName(db, x.id)}>
                            {personName(db, x.id)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {r.side !== 'Company' && r.org ? `${r.side} · ` : ''}
                            {r.processes} Process{r.processes !== 1 && 'es'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[...r.parts].map((t) => (
                          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {t}
                          </span>
                        ))}
                        {r.dm && <DecisionMaker />}
                      </div>
                      {x.links.length > 0 && (
                        <div className="mt-3 truncate text-xs" onClick={(e) => e.stopPropagation()}>
                          <ProfileLinks links={x.links} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
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
