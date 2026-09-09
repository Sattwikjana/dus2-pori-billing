import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="no-print flex flex-wrap items-end justify-between gap-3 px-4 pt-7 pb-6 sm:px-6 lg:pt-9">
      <div>
        <h1 className="display text-2xl text-ink-900 sm:text-[28px]">{title}</h1>
        <div className="gold-rule mt-2.5" />
        {subtitle ? (
          <p className="mt-2.5 text-sm text-ink-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}
