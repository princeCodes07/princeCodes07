import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Mountain, Search, Waves } from "lucide-react";
import { communities, classifyRisk, riskLabel, type RiskLevel } from "@/lib/flood-data";
import { RiskBadge } from "@/components/risk-badge";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities | AccraFloodWatch" },
      {
        name: "description",
        content:
          "Explore communities across Greater Accra and find local flood-risk and weather information.",
      },
    ],
  }),
  component: CommunitiesPage,
});

type Filter = "all" | RiskLevel;

function CommunitiesPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return communities.filter((c) => {
      const matchQ =
        !query ||
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.district.toLowerCase().includes(query.toLowerCase());
      const matchF = filter === "all" || classifyRisk(c.riskPercent) === filter;
      return matchQ && matchF;
    });
  }, [query, filter]);

  return (
    <div className="bg-slate-50">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-water">
              Explore communities
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-navy sm:text-5xl lg:text-5xl">
              Communities
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              Explore communities across Greater Accra and use local context to continue to Current
              Risk or Weather.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search community or district..."
              className="h-14 w-full rounded-[1.25rem] border border-input bg-white pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-water"
              aria-label="Search communities"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter by vulnerability"
            className="inline-flex w-full flex-wrap gap-2 lg:w-auto"
          >
            {(["all", "low", "moderate", "high"] as Filter[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  filter === f
                    ? "bg-water text-white shadow-sm"
                    : "bg-white text-muted-foreground ring-1 ring-border hover:text-navy"
                }`}
              >
                {f === "all" ? "All communities" : `${capitalize(f)} vulnerability`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <article
              key={c.slug}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-navy">{c.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{c.district}</p>
                </div>
                <RiskBadge percent={c.riskPercent} size="sm" showPercent={false} />
              </div>

              <div className="mt-6 rounded-[1.5rem] bg-secondary p-5">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black tracking-[-0.05em] text-navy">
                    {riskLabel(classifyRisk(c.riskPercent))}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Local context
                  </span>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Stat icon={Mountain} label="Elevation" value={`${c.elevationM} m`} />
                <Stat icon={Waves} label="Drainage condition" value={c.drainageQuality} />
              </dl>

              <p className="mt-6 border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
                {c.notes}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/ai-predict"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.1rem] bg-water px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                >
                  Check Current Risk
                </Link>
                <Link
                  to="/weather"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1.1rem] border border-border bg-white px-4 py-3 text-sm font-semibold text-navy transition hover:bg-secondary"
                >
                  View Weather
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-10 rounded-[1.75rem] border border-dashed border-border bg-white p-10 text-center text-muted-foreground">
            No communities found. Try a different search or filter.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] bg-secondary p-4">
      <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-2 text-base font-semibold leading-6 text-navy">{value}</dd>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
