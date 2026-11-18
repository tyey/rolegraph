// PROTOTYPE (tyey/rolegraph#13): three structurally different layouts for the same data.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RoleGraph } from './graph'
import { ListsPanel, PeopleList, PersonView, ProcessList, SearchBox, SearchResults } from './misc'
import { ProcessPanel } from './process'
import { RolePage } from './role'
import { companyName, descendants, isOpen, roleName, useStore } from './store'

function TopBar({ children }: { children?: ReactNode }) {
  const { nav } = useStore()
  return (
    <div className="flex items-center gap-3 border-b bg-white px-3 py-2">
      <button className="font-bold" onClick={() => nav({ role: undefined, process: undefined, person: undefined, q: undefined, tab: undefined, step: undefined })}>
        rolegraph
      </button>
      <SearchBox className="w-[420px]" />
      {children}
      <button className="ml-auto text-xs underline" onClick={() => nav({ tab: 'lists', person: undefined })}>
        Lists
      </button>
    </div>
  )
}

/** A: the graph is the whole app; Processes hang off Roles as chips; everything else opens in a right drawer. */
export function VariantA() {
  const { search, nav } = useStore()
  const drawer = search.q ? 'search' : search.person ? 'person' : search.tab === 'lists' ? 'lists' : search.process ? 'process' : undefined
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="relative flex-1">
        <RoleGraph />
        {drawer && (
          <div className="absolute right-0 top-0 h-full w-[560px] overflow-y-auto border-l bg-white shadow-2xl">
            <button className="absolute right-2 top-2 text-sm" onClick={() => nav({ q: undefined, person: undefined, tab: undefined, process: drawer === 'process' ? undefined : search.process })}>
              ✕
            </button>
            {drawer === 'search' && (
              <div className="p-4">
                <SearchResults />
              </div>
            )}
            {drawer === 'person' && <PersonView id={search.person!} />}
            {drawer === 'lists' && <ListsPanel />}
            {drawer === 'process' && <ProcessPanel id={search.process!} />}
          </div>
        )}
      </div>
    </div>
  )
}

/** B: mail-client master/detail. Graph (Roles only) → Process list for the Role and its descendants → Timeline. */
export function VariantB() {
  const { db, search, nav } = useStore()
  const roleIds = search.role ? descendants(db, search.role) : db.roles.map((r) => r.id)
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="grid flex-1 grid-cols-[340px_420px_1fr] overflow-hidden">
        <div className="border-r">
          <RoleGraph showProcesses={false} />
        </div>
        <div className="overflow-y-auto border-r p-3">
          {search.q ? (
            <SearchResults />
          ) : (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="font-semibold">{search.role ? roleName(db, search.role) : 'All Roles'}</h2>
                {search.role && (
                  <button className="text-xs underline" onClick={() => nav({ role: undefined })}>
                    show all
                  </button>
                )}
                <span className="text-xs text-slate-500">incl. child Roles</span>
              </div>
              <ProcessList roleIds={roleIds} />
            </>
          )}
        </div>
        <div className="overflow-y-auto">
          {search.tab === 'lists' ? <ListsPanel /> : search.person ? <PersonView id={search.person} /> : search.process ? <ProcessPanel id={search.process} /> : <div className="p-6 text-slate-400">Pick a Process.</div>}
        </div>
      </div>
    </div>
  )
}

/** C: document-style. Left outline of the DAG (multi-parent Roles appear under each parent); main area is a full Process page; graph is a tab. */
export function VariantC() {
  const { db, search, nav } = useStore()
  const roots = db.roles.filter((r) => !db.edges.some((e) => e.child === r.id))
  const Outline = ({ id, depth, via }: { id: string; depth: number; via?: string }) => {
    const parents = db.edges.filter((e) => e.child === id).map((e) => e.parent)
    const others = parents.filter((p) => p !== via)
    const kids = db.edges.filter((e) => e.parent === id).map((e) => e.child)
    const ps = db.processes.filter((p) => p.roleId === id)
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        <button className={`block w-full truncate rounded px-2 py-0.5 text-left text-sm font-semibold ${search.role === id ? 'bg-indigo-100' : ''}`} onClick={() => nav({ role: id, tab: 'role' })}>
          {roleName(db, id)}
          {others.length > 0 && <span className="ml-1 text-xs font-normal text-slate-400">↗ also under {others.map((o) => roleName(db, o)).join(', ')}</span>}
        </button>
        {ps.map((p) => (
          <button
            key={p.id}
            className={`ml-3 block w-[calc(100%-12px)] truncate rounded px-2 py-0.5 text-left text-xs ${search.process === p.id ? 'bg-indigo-600 text-white' : isOpen(p) ? '' : 'text-slate-400'}`}
            onClick={() => nav({ process: p.id, person: undefined, tab: undefined, step: undefined })}
          >
            {isOpen(p) ? '●' : '○'} {companyName(db, p)} <span className="opacity-60">{p.outcome ?? p.status}</span>
          </button>
        ))}
        {kids.map((k) => (
          <Outline key={k} id={k} depth={1} via={id} />
        ))}
      </div>
    )
  }
  const tab = search.q ? 'search' : (search.tab ?? (search.person ? 'people' : 'process'))
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-4">
        <button className="flex items-center gap-2" onClick={() => nav({ role: undefined, process: undefined, person: undefined, q: undefined, tab: undefined, step: undefined })}>
          <Logo />
          <span className="text-xl font-extrabold lowercase tracking-tight text-slate-900" style={{ fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif' }}>
            candidacy
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <HeaderPanel label="Help">
            <dl className="space-y-1.5">
              {GLOSSARY.map(([t, d]) => (
                <div key={t}>
                  <dt className="inline font-semibold">{t}</dt> <dd className="inline text-slate-600">{d}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 border-t pt-2 text-slate-500">Full glossary: CONTEXT.md · Runbook: README.md</div>
          </HeaderPanel>
          <HeaderPanel label="About">
            <div className="font-semibold">Candidacy 0.1.0 (prototype)</div>
            <div className="mt-1 text-slate-600">A personal tracker of interview Processes, organised as a graph of Roles.</div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-600">
              <dt className="text-slate-500">Data</dt>
              <dd>local SQLite, this machine only</dd>
              <dt className="text-slate-500">Last export</dt>
              <dd>Nov 17, to the synced folder</dd>
              <dt className="text-slate-500">API</dt>
              <dd>localhost:8000/docs</dd>
              <dt className="text-slate-500">Source</dt>
              <dd>github.com/tyey/rolegraph</dd>
            </dl>
          </HeaderPanel>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
      <nav className="w-96 shrink-0 overflow-y-auto border-r bg-slate-50 p-3">
        <SearchBox className="mb-4" />
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Roles</div>
        <div className="space-y-0.5">
          {roots.map((r) => (
            <Outline key={r.id} id={r.id} depth={0} />
          ))}
        </div>
      </nav>
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex gap-4 border-b px-4 pt-2 text-sm">
          {(['role', 'process', 'people', 'graph', 'search', 'lists'] as const).map((t) => (
            <button key={t} className={`pb-2 ${tab === t ? 'border-b-2 border-indigo-600 font-semibold' : 'text-slate-500'}`} onClick={() => nav({ tab: t === 'process' ? undefined : t, ...(t === 'process' ? { person: undefined } : {}) })}>
              {t === 'role' ? 'Role' : t === 'process' ? 'Process' : t === 'people' ? 'People' : t === 'graph' ? 'Role graph' : t === 'search' ? 'Search' : 'Lists'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {tab === 'role' && (search.role ? <RolePage id={search.role} /> : <div className="p-6 text-slate-400">Pick a Role in the outline.</div>)}
          {tab === 'process' && (search.process ? <ProcessPanel id={search.process} wide /> : <div className="p-6 text-slate-400">Pick a Process in the outline.</div>)}
          {tab === 'people' && (
            <>
              <PeopleList />
              {search.person && (
                <div className="border-t-4 border-slate-100">
                  <PersonView id={search.person} />
                </div>
              )}
            </>
          )}
          {tab === 'graph' && <RoleGraph onOpenProcess={(id) => nav({ process: id, tab: undefined })} />}
          {tab === 'search' && (
            <div className="p-4">
              <SearchResults />
            </div>
          )}
          {tab === 'lists' && <ListsPanel />}
        </div>
      </main>
      </div>
    </div>
  )
}

/** Placeholder mark for Candidacy: a check in a circle. */
function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#4f46e5" />
      <path d="m7.5 12.5 3 3 6-6.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

const GLOSSARY: [string, string][] = [
  ['Role', 'a kind of job you pursue; Roles form a graph (a child is a specialisation).'],
  ['Process', 'one attempt with one Company for one Role: Open or Closed.'],
  ['Step', 'one interaction on a Process Timeline: Planned, Done or Cancelled.'],
  ['Origin', 'the first Step, with the Channel it came through.'],
  ['Participant', 'a Person in one Process, with their Parts.'],
  ['Decision maker', 'a Participant with a say in hiring you.'],
  ['Merge', 'fold a duplicate into another of the same kind.'],
]

/** Header button that drops a small panel below it; closes on outside click. */
function HeaderPanel({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button className={`rounded px-3 py-1 ${open ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && <div className="absolute right-0 top-full z-40 mt-1 w-96 rounded-lg border bg-white p-4 text-xs shadow-xl">{children}</div>}
    </div>
  )
}
