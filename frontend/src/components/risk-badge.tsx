import { classifyRisk, riskLabel, type RiskLevel } from "@/lib/flood-data";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  percent?: number;
  level?: RiskLevel;
  showPercent?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function RiskBadge({
  percent,
  level,
  showPercent = true,
  size = "md",
  className,
}: RiskBadgeProps) {
  const l = level ?? classifyRisk(percent ?? 0);
  const styles: Record<RiskLevel, string> = {
    low: "bg-risk-low text-risk-low-foreground",
    moderate: "bg-risk-moderate text-risk-moderate-foreground",
    high: "bg-risk-high text-risk-high-foreground",
  };
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide",
        styles[l],
        sizes[size],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {riskLabel(l)}
      {showPercent && percent !== undefined && <span className="opacity-90">- {percent}%</span>}
    </span>
  );
}

export function RiskBar({ percent, className }: { percent: number; className?: string }) {
  const level = classifyRisk(percent);
  const barColor =
    level === "low" ? "bg-risk-low" : level === "moderate" ? "bg-risk-moderate" : "bg-risk-high";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all", barColor)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
