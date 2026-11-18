// PROTOTYPE (tyey/rolegraph#13): Role DAG on React Flow + dagre.
import dagre from '@dagrejs/dagre'
import { BaseEdge, Background, Controls, EdgeLabelRenderer, getBezierPath, Handle, MarkerType, Position, ReactFlow, type Connection, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useRef, useState } from 'react'
import { companyName, isOpen, uid, useStore, wouldCycle } from './store'

type RoleData = { label: string; count: number; open: number; selected: boolean }
type ProcData = { label: string; state: string; open: boolean; selected: boolean }

function RoleNode({ data }: NodeProps<Node<RoleData>>) {
  return (
    <div className={`rounded-lg border-2 bg-white px-3 py-2 text-sm shadow-sm ${data.selected ? 'border-indigo-600' : 'border-slate-300'}`}>
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
    <div className={`rounded-full border px-3 py-1 text-xs ${data.selected ? 'ring-2 ring-indigo-500' : ''} ${data.open ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-100 text-slate-500'}`}>
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
  const [picked, setPicked] = useState<string>() // clicked Role edge id 'parent>child'
  const [hovered, setHoveredNow] = useState<string>()
  const leaveTimer = useRef<number>(undefined)
  // Leaving the edge waits a moment, so the pointer can reach the trash icon.
  const setHovered = (id?: string) => {
    clearTimeout(leaveTimer.current)
    if (id) setHoveredNow(id)
    else leaveTimer.current = window.setTimeout(() => setHoveredNow(undefined), 250)
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 60 })
  const procs = showProcesses ? db.processes.filter((p) => closedToo || isOpen(p)) : []
  db.roles.forEach((r) => g.setNode(r.id, { width: 180, height: 50 }))
  procs.forEach((p) => g.setNode(p.id, { width: 170, height: 26 }))
  db.edges.forEach((e) => g.setEdge(e.parent, e.child))
  procs.forEach((p) => g.setEdge(p.roleId, p.id))
  dagre.layout(g)
  const pos = (id: string) => {
    const n = g.node(id)
    return { x: n.x - n.width / 2, y: n.y - n.height / 2 }
  }

  const nodes: Node[] = [
    ...db.roles.map((r) => {
      const ps = db.processes.filter((p) => p.roleId === r.id)
      return { id: r.id, type: 'role', position: pos(r.id), data: { label: r.name, count: ps.length, open: ps.filter(isOpen).length, selected: search.role === r.id } }
    }),
    ...procs.map((p) => ({
      id: p.id,
      type: 'proc',
      position: pos(p.id),
      connectable: false,
      data: { label: companyName(db, p), state: p.outcome ?? p.status, open: isOpen(p), selected: search.process === p.id },
    })),
  ]
  const edges: Edge[] = [
    ...db.edges.map((e) => {
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
    <div className="relative h-full w-full">
      <ReactFlow
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
        {msg && <span className="font-semibold text-red-600">{msg}</span>}
      </div>
    </div>
  )
}
