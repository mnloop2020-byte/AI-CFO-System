import type { LucideIcon } from "lucide-react";

type WidgetTone = "blue" | "green" | "amber" | "red";

type DashboardWidgetProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: WidgetTone;
};

const toneStyles: Record<WidgetTone, string> = {
  blue: "bg-primary-soft text-primary",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  red: "bg-danger-soft text-danger",
};

export default function DashboardWidget({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: DashboardWidgetProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-secondary">
            {title}
          </p>

          <p className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">
            {value}
          </p>
        </div>  
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneStyles[tone]}`}
        >
          <Icon size={21} strokeWidth={1.8} />
        </div>
      </div>

      <p className="mt-4 text-sm text-text-secondary">
        {description}
      </p>
    </article>
  );
}