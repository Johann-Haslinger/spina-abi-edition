import type { ReactNode } from 'react'

export function PageHeader(props: {
  title: ReactNode
  breadcrumb?: ReactNode
  actions?: ReactNode
}) {
  const { title, breadcrumb, actions } = props

  return (
    <div className="flex items-start pt-20 justify-between gap-4">
      <div>
        {breadcrumb ? <div>{breadcrumb}</div> : null}
        <h1 className="text-4xl font-bold text-black dark:text-white">{title}</h1>
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

