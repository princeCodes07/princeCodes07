import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, CloudRain, Gauge, MapPin, ShieldCheck, Waves } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works | AccraFloodWatch" },
      {
        name: "description",
        content:
          "Learn how AccraFloodWatch combines community characteristics and current weather conditions to help you understand flood risk in your area.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const steps = [
  {
    icon: MapPin,
    title: "1. Choose a community",
    body: "Start by selecting the community you want to check.",
  },
  {
    icon: Gauge,
    title: "2. Understand local vulnerability",
    body: "Community characteristics such as terrain and drainage help estimate how vulnerable an area may be to flooding.",
  },
  {
    icon: CloudRain,
    title: "3. Review current weather",
    body: "Where weather information is available, recent and expected rainfall conditions are considered alongside community vulnerability.",
  },
  {
    icon: Waves,
    title: "4. Check current flood risk",
    body: "Community vulnerability and current weather conditions are brought together to show the current flood-risk level.",
  },
  {
    icon: ShieldCheck,
    title: "5. Stay aware",
    body: "Conditions can change quickly. Use the result as guidance for awareness and planning, and follow official emergency instructions when necessary.",
  },
];

function HowItWorksPage() {
  return (
    <div className="bg-slate-50">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-water">
            How it works
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-navy sm:text-5xl lg:text-5xl">
            How It Works
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            AccraFloodWatch combines community characteristics with current weather conditions to
            help you understand flood risk in your area.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <ol className="space-y-5">
          {steps.map((step) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-water text-white">
                <step.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-[-0.04em] text-navy">{step.title}</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-navy">
            Current risk in simple terms
          </h2>
          <div className="mt-6 grid gap-4 text-center sm:grid-cols-3">
            <div className="rounded-[1.5rem] bg-secondary p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Community vulnerability
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-secondary p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Current weather
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-water p-5 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                Current flood risk
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            Current weather may not be available for every community. When it is unavailable, the
            community vulnerability assessment can still be shown.
          </p>
        </section>

        <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-navy">
            What the assessment considers
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            A machine-learning model uses local terrain and drainage characteristics to estimate how
            vulnerable a community may be to flooding.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MethodCard
              title="Elevation"
              body="How high or low an area sits relative to surrounding terrain."
            />
            <MethodCard
              title="Terrain slope"
              body="How steep or flat the area is, which can affect how water moves."
            />
            <MethodCard title="Drainage" body="How easily water can move away from the area." />
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-navy p-7 text-white shadow-sm">
          <h2 className="text-3xl font-bold tracking-[-0.04em]">Risk classification</h2>
          <p className="mt-3 text-sm leading-7 text-white/72">
            Final flood-risk results are shown using three plain-language levels.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <RiskCard
              tone="low"
              title="Low Risk"
              range="0-33%"
              body="Routine monitoring. Keep drains clear and watch for changing weather."
            />
            <RiskCard
              tone="moderate"
              title="Moderate Risk"
              range="34-66%"
              body="Prepare property, clear drains, and pay attention to heavier rainfall windows."
            />
            <RiskCard
              tone="high"
              title="High Risk"
              range="67-100%"
              body="Take protective action early and follow official local emergency guidance."
            />
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-navy">Methodology notes</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              The machine-learning model estimates community vulnerability from terrain and drainage
              characteristics. Current weather is considered separately when calculating current
              flood risk.
            </p>
            <p>
              Current weather conditions are used to adjust the community vulnerability estimate
              when rainfall conditions increase concern. Weather information is provided by
              Open-Meteo.
            </p>
            <p>
              This assessment supports awareness and planning. It is not an official emergency
              warning service and should not replace instructions from emergency authorities.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/ai-predict"
              className="inline-flex items-center gap-2 rounded-2xl bg-water px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Check Current Risk
            </Link>
            <Link
              to="/weather"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-semibold text-navy transition hover:bg-secondary"
            >
              View Weather
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}

function MethodCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-navy">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}

function RiskCard({
  tone,
  title,
  range,
  body,
}: {
  tone: "low" | "moderate" | "high";
  title: string;
  range: string;
  body: string;
}) {
  const bg =
    tone === "low"
      ? "border-risk-low/40 bg-risk-low-soft text-navy"
      : tone === "moderate"
        ? "border-risk-moderate/40 bg-risk-moderate-soft text-navy"
        : "border-risk-high/40 bg-risk-high-soft text-navy";

  const dot =
    tone === "low" ? "bg-risk-low" : tone === "moderate" ? "bg-risk-moderate" : "bg-risk-high";

  return (
    <div className={`rounded-[1.5rem] border p-5 ${bg}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{range}</p>
      <p className="mt-3 text-sm leading-7 opacity-85">{body}</p>
    </div>
  );
}
