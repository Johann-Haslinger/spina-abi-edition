import type { ReactNode } from 'react';

export function PageHeader(props: {
  title: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  const { title, actions } = props;

  return (
    <div className="flex items-start pt-40 justify-between gap-4">
      <div>
        <h1 className="text-4xl mb-6 font-semibold text-black dark:text-white">{title}</h1>
        {/* {breadcrumb ? <div>{breadcrumb}</div> : null} */}
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
