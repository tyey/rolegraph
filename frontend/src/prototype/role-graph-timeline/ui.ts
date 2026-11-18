// PROTOTYPE (tyey/rolegraph#13): the type scale every view uses. Body text is text-sm (14px) in Inter; the wordmark alone is Nunito.
export const T = {
  page: 'text-xl font-semibold text-slate-900', // page title: Company, Role, Person, People
  eyebrow: 'text-xs font-medium uppercase tracking-wide text-slate-500', // what kind of page / sidebar group
  section: 'text-sm font-semibold text-slate-900', // section heading on a page: Timeline, Participants…
  label: 'text-xs font-medium text-slate-500', // field label, sub-heading inside a tile
  table: 'w-full text-sm [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1 [&_th]:pr-3 [&_th]:font-medium',
  thead: 'text-left text-xs font-medium text-slate-500',
}
