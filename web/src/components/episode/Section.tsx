import type { ReactNode } from "react";

interface Props {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** タブで切り替える場合などタイトルが冗長になるとき non-null で隠せる。 */
  hideTitle?: boolean;
  children: ReactNode;
}

export function Section({ title, icon, action, hideTitle, children }: Props) {
  return (
    <section className="space-y-3">
      {(!hideTitle || action) && (
        <div className="flex items-center justify-between gap-3 min-h-6">
          {hideTitle ? (
            <span aria-hidden />
          ) : (
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              {icon && <span className="text-muted-foreground">{icon}</span>}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
