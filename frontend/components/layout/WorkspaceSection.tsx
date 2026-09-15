import type { ReactNode } from "react";

/** Content extracted from a former page; the workspace owns the app shell. */
export function WorkspaceSection({ children, title, actions }: {
  children: ReactNode;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      {actions && <div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div>}
      {children}
    </section>
  );
}
