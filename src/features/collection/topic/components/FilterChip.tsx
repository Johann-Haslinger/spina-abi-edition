export function FilterChip(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <div
      onClick={props.onClick}
      className={
        props.active
          ? 'rounded-full bg-black dark:bg-white px-3 py-1.5 text-xs text-white dark:text-black'
          : 'rounded-full hover:dark:bg-white/5 px-3 py-2 text-xs text-black dark:text-white'
      }
    >
      {props.label}
    </div>
  );
}
