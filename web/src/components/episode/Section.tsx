import type { ReactNode } from "react";

interface Props {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ title, icon, action, children }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
