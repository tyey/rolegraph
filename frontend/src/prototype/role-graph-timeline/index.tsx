// PROTOTYPE (tyey/rolegraph#13): three layouts of the Role graph + Process Timeline, switchable via ?variant=A|B|C.
// Throwaway. Lives on branch prototype/role-graph-timeline-ui only; never merge to main.
import { useEffect } from 'react'
import { ConflictBanner } from './process'
import { StoreProvider, useStore } from './store'
import { VariantA, VariantB, VariantC } from './variants'

const VARIANTS = [
  { key: 'A', name: 'Graph canvas + drawer', C: VariantA },
  { key: 'B', name: 'Three panes', C: VariantB },
  { key: 'C', name: 'Outline + Process page', C: VariantC },
]

function Switcher() {
  const { search, nav, failNext, setFailNext } = useStore()
  const i = Math.max(0, VARIANTS.findIndex((v) => v.key === search.variant))
  const go = (d: number) => nav({ variant: VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length].key }, true)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  })
  if (import.meta.env.PROD) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-xl">
      <button onClick={() => go(-1)}>←</button>
      <span>
        {VARIANTS[i].key} ({VARIANTS[i].name})
      </span>
      <button onClick={() => go(1)}>→</button>
      <span className="opacity-40">|</span>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> next Process save gets 409
      </label>
    </div>
  )
}

function Body() {
  const { search } = useStore()
  const V = (VARIANTS.find((v) => v.key === search.variant) ?? VARIANTS[0]).C
  return (
    <>
      <V />
      <ConflictBanner />
      <Switcher />
    </>
  )
}

export default function Prototype() {
  return (
    <StoreProvider>
      <Body />
    </StoreProvider>
  )
}
