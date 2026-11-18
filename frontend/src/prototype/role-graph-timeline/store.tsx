// PROTOTYPE (tyey/rolegraph#13): in-memory store, fake 409s and URL search params. No persistence.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { seed, type Db, type Process, type Step } from './data'

export type Search = { variant?: string; role?: string; process?: string; person?: string; q?: string; tab?: string; step?: string; hide?: string }

export type Conflict = { processId: string; what: string; base: Process; retry: (db: Db) => void }
type Ctx = {
  db: Db
  write: (what: string, fn: (db: Db) => void, processId?: string) => void
  conflict?: Conflict
  resolveConflict: (keepTheirs: string[] | null) => void
  failNext: boolean
  setFailNext: (v: boolean) => void
  search: Search
  nav: (s: Partial<Search>, replace?: boolean) => void
}
const C = createContext<Ctx>(null!)
export const useStore = () => useContext(C)

const readSearch = (): Search => Object.fromEntries(new URLSearchParams(location.search)) as Search

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(() => structuredClone(seed))
  const [conflict, setConflict] = useState<Conflict>()
  const [failNext, setFailNext] = useState(false)
  const [search, setSearch] = useState<Search>(readSearch)

  useEffect(() => {
    const on = () => setSearch(readSearch())
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])

  const nav = (s: Partial<Search>, replace = false) => {
    const next = { ...search, ...s }
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][])
    history[replace ? 'replaceState' : 'pushState'](null, '', `${location.pathname}?${qs}`)
    setSearch(next)
  }

  const apply = (fn: (db: Db) => void, processId?: string) =>
    setDb((cur) => {
      const d = structuredClone(cur)
      fn(d)
      if (processId) d.processes.find((p) => p.id === processId)!.version++
      return d
    })

  const write: Ctx['write'] = (what, fn, processId) => {
    if (failNext && processId) {
      // Pretend an outside agent saved the same Process first: its edit lands, ours gets 409.
      setFailNext(false)
      const base = structuredClone(db.processes.find((x) => x.id === processId)!)
      apply((d) => {
        const p = d.processes.find((x) => x.id === processId)!
        p.prep = (p.prep ? p.prep + '\n' : '') + '[agent] Team uses Kotlin + Postgres; ask about on-call.'
        const planned = p.steps.find((s) => s.state === 'Planned' && s.day)
        if (planned) planned.time = '09:30'
      }, processId)
      setConflict({ processId, what, base, retry: fn })
      return
    }
    apply(fn, processId)
  }

  // Save = my change on top of theirs, then put back their value for every field the user chose to keep.
  const resolveConflict = (keepTheirs: string[] | null) => {
    if (conflict && keepTheirs)
      apply((d) => {
        const theirs = structuredClone(d.processes.find((x) => x.id === conflict.processId)!)
        conflict.retry(d)
        const p = d.processes.find((x) => x.id === conflict.processId)!
        for (const f of fields(theirs)) if (keepTheirs.includes(f.key)) f.set(p, f.val)
      }, conflict.processId)
    setConflict(undefined)
  }

  return <C.Provider value={{ db, write, conflict, resolveConflict, failNext, setFailNext, search, nav }}>{children}</C.Provider>
}

// ---- read helpers (CQRS-lite reads in the real app) ----
export const roleName = (db: Db, id: string) => db.roles.find((r) => r.id === id)?.name ?? '?'
export const companyName = (db: Db, p: Process) =>
  p.companyId ? db.companies.find((c) => c.id === p.companyId)!.name : 'Company not named yet'
export const agencyName = (db: Db, p: Process) => (p.agencyId ? db.agencies.find((a) => a.id === p.agencyId)!.name : undefined)
export const personName = (db: Db, id?: string) => {
  const p = db.persons.find((x) => x.id === id)
  return p ? (p.name ?? `“${p.description}”`) : '?'
}
export const processTitle = (db: Db, p: Process) => `${companyName(db, p)} · ${roleName(db, p.roleId)}`
/** Persons sharing a Profile link with this one, minus pairs the user marked as different humans. */
export const likelyDuplicates = (db: Db, id: string) => {
  const me = db.persons.find((x) => x.id === id)
  if (!me) return []
  const dismissed = (o: string) => db.notDuplicates.some(([a, b]) => (a === id && b === o) || (a === o && b === id))
  return db.persons.filter((x) => x.id !== id && x.links.some((l) => me.links.includes(l)) && !dismissed(x.id))
}
// ---- palette: one colour family per Process state (see #13 resolution) ----
export const STATE_STYLE: Record<string, { pill: string; dot: string; chip: string }> = {
  Active: { pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', chip: 'border-emerald-400 bg-emerald-50 text-emerald-900' },
  'On hold': { pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', chip: 'border-slate-300 bg-slate-50 text-slate-600' },
  'Offer received': { pill: 'bg-fuchsia-100 text-fuchsia-800', dot: 'bg-fuchsia-500', chip: 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-900' },
  Accepted: { pill: 'bg-emerald-700 text-white', dot: 'bg-emerald-700', chip: 'border-emerald-700 bg-emerald-700 text-white' },
  Rejected: { pill: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', chip: 'border-rose-300 bg-rose-50 text-rose-800' },
  Declined: { pill: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300', chip: 'border-slate-200 bg-slate-50 text-slate-400' },
  Withdrawn: { pill: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300', chip: 'border-slate-200 bg-slate-50 text-slate-400' },
  Ghosted: { pill: 'bg-slate-100 text-slate-400', dot: 'bg-slate-300', chip: 'border-dashed border-slate-300 bg-slate-50 text-slate-400' },
}
export const processState = (p: Process) => (p.outcome ?? p.status)!
export const StatePill = ({ p }: { p: Process }) => (
  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[processState(p)].pill}`}>{processState(p)}</span>
)
export const DecisionMaker = () => <span className="whitespace-nowrap rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">⚖︎ Decision maker</span>
export const isOpen = (p: Process) => !p.outcome

/** Origin first, then dated Steps by day+time, then undated Planned Steps in the user's order. */
export const timeline = (steps: Step[]) => {
  const origin = steps.filter((s) => s.origin)
  const dated = steps.filter((s) => !s.origin && s.day).sort((a, b) => `${a.day}${a.time ?? ''}`.localeCompare(`${b.day}${b.time ?? ''}`))
  const undated = steps.filter((s) => !s.origin && !s.day)
  return [...origin, ...dated, ...undated]
}

export const descendants = (db: Db, roleId: string): string[] => {
  const kids = db.edges.filter((e) => e.parent === roleId).map((e) => e.child)
  return [roleId, ...kids.flatMap((k) => descendants(db, k))]
}
export const wouldCycle = (db: Db, parent: string, child: string) => descendants(db, child).includes(parent)

export const fmtDay = (day?: string) =>
  day ? new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(day + 'T12:00')) : 'No date yet'
export const uid = () => Math.random().toString(36).slice(2, 8)

// ---- field view of a Process, for the 409 compare ----
type Field = { key: string; label: string; val: unknown; set: (p: Process, v: unknown) => void }
const PROC_KEYS = ['status', 'outcome', 'prep', 'roleId', 'companyId', 'agencyId', 'participants'] as const
const STEP_KEYS = ['kind', 'state', 'day', 'time', 'endDay', 'prep', 'reflection', 'feedback', 'docs', 'participants'] as const
export function fields(p: Process): Field[] {
  const out: Field[] = PROC_KEYS.map((k) => ({ key: k, label: `Process · ${k}`, val: p[k], set: (q, v) => ((q as Record<string, unknown>)[k] = structuredClone(v)) }))
  for (const s of p.steps)
    for (const k of STEP_KEYS)
      out.push({
        key: `${s.id}.${k}`,
        label: `${s.kind}${s.day ? ' ' + s.day : ''} · ${k}`,
        val: s[k],
        set: (q, v) => {
          const t = q.steps.find((x) => x.id === s.id)
          if (t) (t as Record<string, unknown>)[k] = structuredClone(v)
        },
      })
  return out
}
