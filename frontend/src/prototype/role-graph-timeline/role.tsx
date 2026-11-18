// PROTOTYPE (tyey/rolegraph#13): Role page for layout C.
import { useState } from 'react'
import type { Db } from './data'
import { ProcessList } from './misc'
import { descendants, roleName, uid, useStore, wouldCycle } from './store'

const hasCycle = (d: Db) => d.roles.some((r) => d.edges.some((e) => e.parent !== r.id && e.child === r.id && descendants(d, r.id).includes(e.parent)))

export function RolePage({ id }: { id: string }) {
  const { db, write, nav } = useStore()
  const [withKids, setWithKids] = useState(true)
  const [msg, setMsg] = useState('')
  const role = db.roles.find((r) => r.id === id)
  if (!role) return <div className="p-6 text-slate-400">That Role was Merged away.</div>
  const parents = db.edges.filter((e) => e.child === id).map((e) => e.parent)
  const kids = db.edges.filter((e) => e.parent === id).map((e) => e.child)
  const own = db.processes.filter((p) => p.roleId === id).length
  const link = (r: string, unlink: () => void) => (
    <span key={r} className="mr-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5">
      <button className="underline" onClick={() => nav({ role: r })}>
        {roleName(db, r)}
      </button>
      <button className="text-slate-400" title="remove this edge" onClick={unlink}>
        ×
      </button>
    </span>
  )
  const addEdge = (parent: string, child: string) => {
    if (wouldCycle(db, parent, child)) return setMsg('Refused: that edge would make a cycle.')
    setMsg('')
    write('add Role edge', (d) => d.edges.push({ parent, child }))
  }
  const others = db.roles.filter((r) => r.id !== id)
  return (
    <div className="space-y-4 p-4 text-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">Role</div>
      <h2 className="text-xl font-bold">{role.name}</h2>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          className="rounded border px-2"
          onClick={() => {
            const n = prompt('Rename Role', role.name)
            if (n) write('rename Role', (d) => (d.roles.find((r) => r.id === id)!.name = n))
          }}
        >
          Rename
        </button>
        <button
          className="rounded border px-2"
          onClick={() => {
            const n = prompt('New child Role name')
            if (!n) return
            const cid = 'r-' + uid()
            write('add child Role', (d) => {
              d.roles.push({ id: cid, name: n })
              d.edges.push({ parent: id, child: cid })
            })
          }}
        >
          + child Role
        </button>
        <select
          className="rounded border"
          value=""
          onChange={(e) => {
            const into = e.target.value
            const next = structuredClone(db)
            next.processes.forEach((p) => p.roleId === id && (p.roleId = into))
            next.edges = next.edges
              .map((x) => ({ parent: x.parent === id ? into : x.parent, child: x.child === id ? into : x.child }))
              .filter((x, i, a) => x.parent !== x.child && a.findIndex((y) => y.parent === x.parent && y.child === x.child) === i)
            next.roles = next.roles.filter((r) => r.id !== id)
            if (hasCycle(next)) return setMsg(`Refused: merging into ${roleName(db, into)} would make a cycle.`)
            write('merge Role', (d) => Object.assign(d, next))
            nav({ role: into })
          }}
        >
          <option value="">Merge into…</option>
          {others.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          className="rounded border px-2 disabled:opacity-40"
          disabled={own > 0 || kids.length > 0}
          title={own || kids.length ? 'Refused: this Role still has Processes or child Roles' : ''}
          onClick={() => {
            write('delete Role', (d) => {
              d.roles = d.roles.filter((r) => r.id !== id)
              d.edges = d.edges.filter((e) => e.child !== id)
            })
            nav({ role: undefined, tab: undefined })
          }}
        >
          Delete
        </button>
      </div>
      {msg && <div className="text-xs font-semibold text-red-600">{msg}</div>}
      <div className="grid grid-cols-[90px_1fr] gap-y-2 text-xs">
        <span className="text-slate-500">Parents</span>
        <div>
          {parents.map((r) => link(r, () => write('remove Role edge', (d) => (d.edges = d.edges.filter((e) => !(e.parent === r && e.child === id))))))}
          {parents.length === 0 && <span className="mr-1 text-slate-400">none (a root)</span>}
          <select className="rounded border" value="" onChange={(e) => addEdge(e.target.value, id)}>
            <option value="">+ parent…</option>
            {others.filter((r) => !parents.includes(r.id)).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-slate-500">Children</span>
        <div>
          {kids.map((r) => link(r, () => write('remove Role edge', (d) => (d.edges = d.edges.filter((e) => !(e.parent === id && e.child === r))))))}
          {kids.length === 0 && <span className="mr-1 text-slate-400">none</span>}
          <select className="rounded border" value="" onChange={(e) => addEdge(id, e.target.value)}>
            <option value="">+ existing child…</option>
            {others.filter((r) => !kids.includes(r.id)).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-baseline gap-3">
          <h3 className="font-semibold">Processes</h3>
          <label className="text-xs">
            <input type="checkbox" checked={withKids} onChange={(e) => setWithKids(e.target.checked)} /> include child Roles
          </label>
        </div>
        <ProcessList roleIds={withKids ? descendants(db, id) : [id]} />
      </div>
    </div>
  )
}
