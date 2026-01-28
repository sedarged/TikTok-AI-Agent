import { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function SectionCard({ title, children, actions }: SectionCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}
