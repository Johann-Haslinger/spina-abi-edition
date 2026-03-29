import type { ReactNode } from 'react';

export function PageHeader(props: {
  title: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  const { title, actions } = props;

  return (
    <div className="flex items-start pt-28 justify-between gap-4">
      <div>
        <h1 className="text-[2.6rem] mb-4 font-semibold text-black dark:text-white/90">{title}</h1>
        {/* {breadcrumb ? <div>{breadcrumb}</div> : null} */}
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
