import { useEffect, useRef, useState, type ReactNode } from 'react'

// PROTOTYPE (tyey/rolegraph#13): the type scale every view uses. Body text is text-sm (14px) in Inter; the wordmark alone is Nunito.
export const T = {
  page: 'text-xl font-semibold text-slate-900', // page title: Company, Role, Person, People
  eyebrow: 'text-xs font-medium uppercase tracking-wide text-slate-500', // what kind of page / sidebar group
  section: 'text-sm font-semibold text-slate-900', // section heading on a page: Timeline, Participants…
  label: 'text-xs font-medium text-slate-500', // field label, sub-heading inside a tile
  table: 'w-full text-sm [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1 [&_th]:pr-3 [&_th]:font-medium',
  thead: 'text-left text-xs font-medium text-slate-500',
}

export function Chip({ children, onClick, onRemove, big = false }: { children: ReactNode; onClick: () => void; onRemove: () => void; big?: boolean }) {
  return (
    <span className={`group inline-flex items-center gap-1 rounded-full border bg-white ${big ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'} hover:border-indigo-300`}>
      <button className="font-medium text-slate-800" onClick={onClick}>
        {children}
      </button>
      <button className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-600" title="Unlink" aria-label="Unlink" onClick={onRemove}>
        ×
      </button>
    </span>
  )
}

/** "+ label" chip that opens a filterable list; optionally creates a new entry from the typed text. */
export function AddChip({ label, options, onPick, onNew, big = false, placeholder = 'Role name' }: { label: string; options: { id: string; name: string }[]; onPick: (id: string) => void; onNew?: (name: string) => void; big?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useOutside(() => setOpen(false))
  const hits = options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()))
  const done = () => (setOpen(false), setQ(''))
  return (
    <span ref={ref} className="relative inline-block">
      <button className={`rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-700 ${big ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'}`} onClick={() => setOpen(!open)}>
        + {label}
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-lg border bg-white p-1 text-sm shadow-xl">
          <input autoFocus className="mb-1 w-full rounded border px-2 py-1" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.map((o) => (
            <button key={o.id} className="block w-full rounded px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => (onPick(o.id), done())}>
              {o.name}
            </button>
          ))}
          {onNew && q.trim() && !options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase()) && (
            <button className="block w-full rounded px-3 py-1.5 text-left text-indigo-700 hover:bg-indigo-50" onClick={() => (onNew(q.trim()), done())}>
              Create “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </span>
  )
}

export const Stat = ({ n, label }: { n: ReactNode; label: string }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <div className="truncate text-2xl font-semibold text-slate-900">{n}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
)

export const Icon = ({ d, w = 2, size = 16 }: { d: string; w?: number; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

export function useOutside(close: () => void) {
  const ref = useRef<HTMLSpanElement & HTMLDivElement>(null)
  const cb = useRef(close)
  cb.current = close
  useEffect(() => {
    const on = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && cb.current()
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [])
  return ref
}

export const Avatar = ({ name, placeholder = false }: { name: string; placeholder?: boolean }) => (
  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${placeholder ? 'border border-dashed border-slate-300 text-slate-400' : 'bg-indigo-100 text-indigo-800'}`}>
    {placeholder ? '?' : name.replace(/[“”"]/g, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
  </span>
)

/** ⋯ button with a small menu; items are [label, onClick, {danger, disabledReason}]. */
export function Menu({ items }: { items: [string, () => void, { danger?: boolean; disabledReason?: string }?][] }) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="More actions" title="More actions" onClick={() => setOpen(!open)}>
        <Icon d="M5 12h.01M12 12h.01M19 12h.01" w={4} size={20} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border bg-white p-1 text-sm shadow-xl">
          {items.map(([label, fn, o]) => (
            <button
              key={label}
              disabled={!!o?.disabledReason}
              title={o?.disabledReason}
              className={`block w-full rounded px-3 py-1.5 text-left disabled:text-slate-300 ${o?.danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-slate-100'}`}
              onClick={() => (setOpen(false), fn())}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`rounded-xl border bg-white p-4 ${className}`}>{children}</div>

export const Segmented = <V extends string>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) => (
  <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs">
    {options.map(([v, label]) => (
      <button key={v} className={`rounded-full px-3 py-0.5 ${value === v ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`} onClick={() => onChange(v)}>
        {label}
      </button>
    ))}
  </div>
)
