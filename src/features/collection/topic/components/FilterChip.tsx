export function FilterChip(props: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        props.active
          ? 'rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50'
          : 'rounded-md bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-50'
      }
    >
      {props.label}
    </button>
  )
}

