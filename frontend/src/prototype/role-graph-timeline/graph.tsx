// PROTOTYPE (tyey/rolegraph#13): Role DAG on React Flow + dagre.
import dagre from '@dagrejs/dagre'
import { BaseEdge, Background, Controls, EdgeLabelRenderer, getBezierPath, Handle, MarkerType, Position, ReactFlow, type Connection, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Db } from './data'
import { useEffect, useRef, useState } from 'react'
import { companyName, isOpen, roleName, STATE_STYLE, uid, useStore, wouldCycle } from './store'

type RoleData = { label: string; count: number; open: number; selected: boolean }
type ProcData = { label: string; state: string; open: boolean; selected: boolean }

function RoleNode({ data }: NodeProps<Node<RoleData>>) {
  return (
    <div className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm shadow-sm ${data.selected ? 'border-indigo-600' : 'border-slate-300'}`}>
      <Handle type="target" position={Position.Top} title="Parent Roles connect here" />
      <div className="font-semibold">{data.label}</div>
      <div className="text-xs text-slate-500">
        {data.open} open · {data.count} total
      </div>
      <Handle type="source" position={Position.Bottom} title="Drag to a child Role" className="!h-3 !w-3 !bg-indigo-500" />
    </div>
  )
}
function ProcNode({ data }: NodeProps<Node<ProcData>>) {
  return (
    <div className={`w-full truncate whitespace-nowrap rounded-full border px-3 py-1 text-center text-xs ${data.selected ? 'ring-2 ring-indigo-500' : ''} ${STATE_STYLE[data.state].chip}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {data.label} <span className="opacity-70">· {data.state}</span>
    </div>
  )
}
const nodeTypes = { role: RoleNode, proc: ProcNode }

type RoleEdgeData = { active: boolean; onHover: (on: boolean) => void; onDelete: () => void }
function RoleEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }: EdgeProps<Edge<RoleEdgeData>>) {
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={20} />
      {data?.active && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan pointer-events-auto absolute rounded-full border border-red-300 bg-white p-1 text-red-600 shadow hover:bg-red-50"
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
            title="Remove this edge"
            aria-label="Remove this edge"
            onMouseEnter={() => data.onHover(true)}
            onMouseLeave={() => data.onHover(false)}
            onClick={data.onDelete}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
const edgeTypes = { role: RoleEdge }

export function RoleGraph({ showProcesses = true, onOpenProcess }: { showProcesses?: boolean; onOpenProcess?: (id: string) => void }) {
  const { db, write, search, nav } = useStore()
  const [closedToo, setClosedToo] = useState(false)
  const [msg, setMsg] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setPane({ w: e.contentRect.width, h: e.contentRect.height }))
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const [picked, setPicked] = useState<string>() // clicked Role edge id 'parent>child'
  const [hovered, setHoveredNow] = useState<string>()
  const leaveTimer = useRef<number>(undefined)
  // Leaving the edge waits a moment, so the pointer can reach the trash icon.
  const setHovered = (id?: string) => {
    clearTimeout(leaveTimer.current)
    if (id) setHoveredNow(id)
    else leaveTimer.current = window.setTimeout(() => setHoveredNow(undefined), 250)
  }

  // Independent parts of the DAG (connected components), each named by its roots; hidden ones are listed in ?hide=.
  const comps = components(db)
  const hidden = new Set((search.hide ?? '').split(',').filter(Boolean))
  const visible = new Set(comps.filter((c) => !hidden.has(c.key)).flatMap((c) => c.roles))
  const roles = db.roles.filter((r) => visible.has(r.id))
  const roleEdges = db.edges.filter((e) => visible.has(e.parent))
  const procs = showProcesses ? db.processes.filter((p) => visible.has(p.roleId) && (closedToo || isOpen(p))) : []
  // Sizes come from the text, and the same widths are put on the nodes, so dagre's spacing matches what renders.
  const roleW = (name: string) => Math.min(280, Math.max(160, name.length * 8 + 40))
  const procW = (p: (typeof procs)[number]) => Math.min(300, Math.max(140, (companyName(db, p) + ' · ' + (p.outcome ?? p.status)).length * 6.5 + 36))
  const layout = (ranksep: number) => {
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep })
    roles.forEach((r) => g.setNode(r.id, { width: roleW(r.name), height: 56 }))
    procs.forEach((p) => g.setNode(p.id, { width: procW(p), height: 28 }))
    roleEdges.forEach((e) => g.setEdge(e.parent, e.child))
    procs.forEach((p) => g.setEdge(p.roleId, p.id))
    dagre.layout(g)
    return g
  }
  // A wide, flat DAG in a tall pane leaves empty space: stretch the rank gap until the shape roughly matches the pane.
  let g = layout(60)
  const { width: gw = 1, height: gh = 1 } = g.graph()
  const ranks = new Set(g.nodes().map((n) => g.node(n).y)).size
  if (pane.w && ranks > 1) {
    const scale = Math.min(pane.w / gw, pane.h / gh)
    const spare = (pane.h * 0.85) / scale - gh
    if (spare > 0) g = layout(Math.min(60 + spare / (ranks - 1), 220))
  }
  const pos = (id: string) => {
    const n = g.node(id)
    return { x: n.x - n.width / 2, y: n.y - n.height / 2 }
  }

  const nodes: Node[] = [
    ...roles.map((r) => {
      const ps = db.processes.filter((p) => p.roleId === r.id)
      return { id: r.id, type: 'role', position: pos(r.id), style: { width: roleW(r.name) }, data: { label: r.name, count: ps.length, open: ps.filter(isOpen).length, selected: search.role === r.id } }
    }),
    ...procs.map((p) => ({
      id: p.id,
      type: 'proc',
      position: pos(p.id),
      style: { width: procW(p) },
      connectable: false,
      data: { label: companyName(db, p), state: p.outcome ?? p.status, open: isOpen(p), selected: search.process === p.id },
    })),
  ]
  const edges: Edge[] = [
    ...roleEdges.map((e) => {
      const id = `${e.parent}>${e.child}`
      const on = picked === id || hovered === id
      return {
        id,
        type: 'role',
        source: e.parent,
        target: e.child,
        markerEnd: { type: MarkerType.ArrowClosed, color: on ? '#dc2626' : undefined },
        style: on ? { stroke: '#dc2626', strokeWidth: 3 } : undefined,
        data: {
          active: on,
          onHover: (h: boolean) => setHovered(h ? id : undefined),
          onDelete: () => {
            write('remove Role edge', (d) => (d.edges = d.edges.filter((x) => !(x.parent === e.parent && x.child === e.child))))
            setPicked(undefined)
            setHovered(undefined)
          },
        },
      }
    }),
    ...procs.map((p) => ({ id: `${p.roleId}>${p.id}`, source: p.roleId, target: p.id, style: { strokeDasharray: '4 3', stroke: '#94a3b8' } })),
  ]

  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    if (db.edges.some((e) => e.parent === c.source && e.child === c.target)) return
    if (wouldCycle(db, c.source, c.target)) return setMsg('Refused: that edge would make a cycle.')
    setMsg('')
    write('add Role edge', (d) => d.edges.push({ parent: c.source!, child: c.target! }))
  }

  return (
    <div ref={box} className="relative h-full w-full">
      <ReactFlow
        key={nodes.map((n) => n.id).join() + edges.map((e) => e.id).join() + Math.round(pane.w) + 'x' + Math.round(pane.h)} // re-fit the view whenever the shape changes
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onNodeClick={(_, n) => (n.type === 'proc' ? (onOpenProcess ? onOpenProcess(n.id) : nav({ process: n.id, person: undefined })) : nav({ role: n.id }))}
        edgeTypes={edgeTypes}
        onEdgeClick={(_, e) => setPicked(e.type === 'role' ? e.id : undefined)}
        onEdgeMouseEnter={(_, e) => e.type === 'role' && setHovered(e.id)}
        onEdgeMouseLeave={() => setHovered(undefined)}
        onPaneClick={() => setPicked(undefined)}
        deleteKeyCode={null}
        nodesDraggable={false}
        fitView
        fitViewOptions={{ padding: 0.08, maxZoom: 1.6 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="absolute left-2 top-2 flex flex-wrap items-center gap-2 rounded bg-white/90 p-2 text-xs shadow">
        <button
          className="rounded bg-indigo-600 px-2 py-1 text-white"
          onClick={() => {
            const name = prompt('New Role name')
            if (name) write('add Role', (d) => d.roles.push({ id: 'r-' + uid(), name }))
          }}
        >
          + Role
        </button>
        {showProcesses && (
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={closedToo} onChange={(e) => setClosedToo(e.target.checked)} /> show Closed Processes
          </label>
        )}
        {comps.length > 1 &&
          comps.map((c) => {
            const off = hidden.has(c.key)
            return (
              <button
                key={c.key}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${off ? 'text-slate-400 line-through' : 'border-indigo-300 bg-indigo-50'}`}
                title={off ? 'Show' : 'Hide'}
                onClick={() => nav({ hide: [...(off ? [...hidden].filter((k) => k !== c.key) : [...hidden, c.key])].join(',') || undefined }, true)}
              >
                {off ? <EyeOff /> : <Eye />}
                {c.roots.map((r) => roleName(db, r)).join(' + ')}
              </button>
            )
          })}
        {msg && <span className="font-semibold text-red-600">{msg}</span>}
      </div>
    </div>
  )
}

/** Weakly connected parts of the Role DAG, keyed and named by their roots. */
function components(db: Db) {
  const parent = new Map(db.roles.map((r) => [r.id, r.id]))
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!))
  db.edges.forEach((e) => parent.set(find(e.parent), find(e.child)))
  const groups = new Map<string, string[]>()
  db.roles.forEach((r) => groups.set(find(r.id), [...(groups.get(find(r.id)) ?? []), r.id]))
  return [...groups.values()].map((roles) => {
    const roots = roles.filter((r) => !db.edges.some((e) => e.child === r))
    return { key: roots.slice().sort().join('+'), roots, roles }
  })
}

const Eye = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOff = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <path d="M3 3l18 18" />
  </svg>
)
