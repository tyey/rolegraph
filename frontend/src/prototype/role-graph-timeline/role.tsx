// PROTOTYPE (tyey/rolegraph#13): Role page for layout C — cards and chips instead of form controls.
import { useState, type ReactNode } from 'react'
import type { Db, Process } from './data'
import { companyName, descendants, fmtDay, isOpen, roleName, StatePill, uid, useStore, wouldCycle } from './store'
import { AddChip, Chip, Icon, Stat, T, useOutside } from './ui'

const hasCycle = (d: Db) => d.roles.some((r) => d.edges.some((e) => e.parent !== r.id && e.child === r.id && descendants(d, r.id).includes(e.parent)))

export function RolePage({ id }: { id: string }) {
  const { db, write, nav } = useStore()
  const [withKids, setWithKids] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [msg, setMsg] = useState('')
  const role = db.roles.find((r) => r.id === id)
  if (!role) return <div className="p-6 text-slate-400">That Role was Merged away.</div>
  const parents = db.edges.filter((e) => e.child === id).map((e) => e.parent)
  const kids = db.edges.filter((e) => e.parent === id).map((e) => e.child)
  const own = db.processes.filter((p) => p.roleId === id)
  const ps = db.processes.filter((p) => (withKids ? descendants(db, id) : [id]).includes(p.roleId))
  const open = ps.filter(isOpen)
  const closed = ps.filter((p) => !isOpen(p))
  const others = db.roles.filter((r) => r.id !== id)
  const addEdge = (parent: string, child: string) => {
    if (wouldCycle(db, parent, child)) return setMsg('That would make a loop between Roles.')
    setMsg('')
    write('add Role edge', (d) => d.edges.push({ parent, child }))
  }
  const unlink = (parent: string, child: string) => write('remove Role edge', (d) => (d.edges = d.edges.filter((e) => !(e.parent === parent && e.child === child))))

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          {parents.length > 0 && (
            <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              Specialisation of
              {parents.map((r) => (
                <Chip key={r} onClick={() => nav({ role: r })} onRemove={() => unlink(r, id)}>
                  {roleName(db, r)}
                </Chip>
              ))}
              <AddChip label="Add" options={others.filter((r) => !parents.includes(r.id))} onPick={(r) => addEdge(r, id)} />
            </div>
          )}
          {renaming ? (
            <input
              autoFocus
              defaultValue={role.name}
              className={`${T.page} w-full rounded border border-indigo-300 px-1`}
              onBlur={(e) => {
                const n = e.target.value.trim()
                if (n && n !== role.name) write('rename Role', (d) => (d.roles.find((r) => r.id === id)!.name = n))
                setRenaming(false)
              }}
              onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setRenaming(false))}
            />
          ) : (
            <h2 className={`${T.page} group flex items-center gap-2`}>
              {role.name}
              <button className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-slate-600" title="Rename" aria-label="Rename" onClick={() => setRenaming(true)}>
                <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </button>
            </h2>
          )}
          {parents.length === 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              Top-level Role
              <AddChip label="Make it a specialisation" options={others} onPick={(r) => addEdge(r, id)} />
            </div>
          )}
          {msg && <div className="mt-1 text-xs text-red-600">{msg}</div>}
        </div>
        <RoleMenu id={id} canDelete={own.length === 0 && kids.length === 0} />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat n={open.length} label="Open" />
        <Stat n={ps.filter((p) => p.status === 'Offer received' || p.outcome === 'Accepted').length} label="Offers" />
        <Stat n={closed.length} label="Closed" />
      </div>

      <section>
        <div className="mb-3 flex items-baseline gap-3">
          <h3 className={T.section}>Specialisations</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {kids.map((k) => {
            const n = db.processes.filter((p) => descendants(db, k).includes(p.roleId) && isOpen(p)).length
            return (
              <Chip key={k} big onClick={() => nav({ role: k })} onRemove={() => unlink(id, k)}>
                {roleName(db, k)} <span className="text-slate-400">{n} open</span>
              </Chip>
            )
          })}
          <AddChip
            big
            label="Add specialisation"
            options={others.filter((r) => !kids.includes(r.id))}
            onPick={(r) => addEdge(id, r)}
            onNew={(name) => {
              const cid = 'r-' + uid()
              write('add child Role', (d) => {
                d.roles.push({ id: cid, name })
                d.edges.push({ parent: id, child: cid })
              })
            }}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <h3 className={T.section}>Processes</h3>
          {kids.length > 0 && (
            <div className="flex rounded-full bg-slate-100 p-0.5 text-xs">
              {[false, true].map((v) => (
                <button key={String(v)} className={`rounded-full px-3 py-0.5 ${withKids === v ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`} onClick={() => setWithKids(v)}>
                  {v ? 'With specialisations' : 'This Role only'}
                </button>
              ))}
            </div>
          )}
        </div>
        {open.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-slate-400">No open Processes</div>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {open.map((p) => (
            <ProcessCard key={p.id} p={p} showRole={p.roleId !== id} />
          ))}
        </div>
        {closed.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">History · {closed.length} closed</summary>
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {closed.map((p) => (
                <ProcessCard key={p.id} p={p} showRole={p.roleId !== id} />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  )
}

export function ProcessCard({ p, showRole, children }: { p: Process; showRole: boolean; children?: ReactNode }) {
  const { db, nav } = useStore()
  const next = p.steps.find((s) => s.state === 'Planned')
  const last = [...p.steps].reverse().find((s) => s.state === 'Done')
  return (
    <button
      className={`rounded-xl border bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm ${isOpen(p) ? '' : 'opacity-70'}`}
      onClick={() => nav({ process: p.id, person: undefined, step: undefined, tab: undefined })}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-slate-900">{companyName(db, p)}</div>
        <StatePill p={p} />
      </div>
      {showRole && <div className="mt-0.5 text-xs text-slate-500">{roleName(db, p.roleId)}</div>}
      <div className="mt-3 text-xs text-slate-600">
        {next ? (
          <>
            Next: <span className="font-medium text-slate-900">{next.kind}</span> · {fmtDay(next.day)}
          </>
        ) : last ? (
          <>
            Last: {last.kind} · {fmtDay(last.day)}
          </>
        ) : null}
      </div>
      {children}
    </button>
  )
}

function RoleMenu({ id, canDelete }: { id: string; canDelete: boolean }) {
  const { db, write, nav } = useStore()
  const [open, setOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const [msg, setMsg] = useState('')
  const ref = useOutside(() => (setOpen(false), setMerging(false)))
  const merge = (into: string) => {
    const next = structuredClone(db)
    next.processes.forEach((p) => p.roleId === id && (p.roleId = into))
    next.edges = next.edges
      .map((x) => ({ parent: x.parent === id ? into : x.parent, child: x.child === id ? into : x.child }))
      .filter((x, i, a) => x.parent !== x.child && a.findIndex((y) => y.parent === x.parent && y.child === x.child) === i)
    next.roles = next.roles.filter((r) => r.id !== id)
    if (hasCycle(next)) return setMsg(`Merging into ${roleName(db, into)} would make a loop.`)
    write('merge Role', (d) => Object.assign(d, next))
    nav({ role: into })
  }
  return (
    <div ref={ref} className="relative">
      <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="More actions" title="More actions" onClick={() => setOpen(!open)}>
        <Icon d="M5 12h.01M12 12h.01M19 12h.01" w={4} size={20} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border bg-white p-1 text-sm shadow-xl">
          {!merging ? (
            <>
              <button className="block w-full rounded px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => setMerging(true)}>
                Merge into another Role…
              </button>
              <button
                className="block w-full rounded px-3 py-1.5 text-left text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                disabled={!canDelete}
                title={canDelete ? '' : 'Only an empty Role, with no Processes or specialisations, can be deleted'}
                onClick={() => {
                  write('delete Role', (d) => {
                    d.roles = d.roles.filter((r) => r.id !== id)
                    d.edges = d.edges.filter((e) => e.child !== id)
                  })
                  nav({ role: undefined, tab: undefined })
                }}
              >
                Delete Role
              </button>
            </>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 text-xs text-slate-500">Merge into…</div>
              {db.roles
                .filter((r) => r.id !== id)
                .map((r) => (
                  <button key={r.id} className="block w-full rounded px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => merge(r.id)}>
                    {r.name}
                  </button>
                ))}
              {msg && <div className="px-3 py-1.5 text-xs text-red-600">{msg}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

