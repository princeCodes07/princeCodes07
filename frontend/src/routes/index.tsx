import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, CloudRain, MapPin, ShieldCheck, Waves } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AccraFloodWatch | Flood Risk & Weather" },
      {
        name: "description",
        content:
          "Check current flood risk, view weather conditions, and explore community flood context across Greater Accra.",
      },
    ],
  }),
  component: Home,
});

const heroHighlights = [
  { label: "Current Risk", value: "Now", icon: Activity },
  { label: "Weather", value: "Live", icon: CloudRain },
  { label: "Communities", value: "Explore", icon: MapPin },
  { label: "Preparedness", value: "Plan", icon: ShieldCheck },
] as const;

const toolkitItems = [
  {
    title: "Current Risk",
    body: "Check current flood conditions in your community.",
  },
  {
    title: "Weather",
    body: "See the latest rainfall outlook and weather conditions.",
  },
  {
    title: "Communities",
    body: "Explore areas across Greater Accra and plan ahead.",
  },
] as const;

const sectionChips = ["Before rainfall", "During peak storms", "After localized flooding"] as const;

const capabilityItems = [
  "Check current flood risk for your community before heavy rain intensifies.",
  "View rainfall outlook and weather conditions for supported communities.",
  "Explore communities across Greater Accra and understand where flooding may be a concern.",
] as const;

const snapshotItems = [
  { title: "Current risk", status: "Check now" },
  { title: "Weather outlook", status: "Track rain" },
  { title: "Communities", status: "Browse areas" },
  { title: "Flood awareness", status: "Stay aware" },
  { title: "Preparedness", status: "Plan ahead" },
  { title: "Local context", status: "See more" },
] as const;

const quickActionCards = [
  {
    icon: Activity,
    title: "Check current risk",
    body: "See the current flood outlook for your community and get a quick sense of conditions right now.",
    to: "/ai-predict" as const,
    cta: "Check Current Risk",
  },
  {
    icon: CloudRain,
    title: "Follow the weather",
    body: "Review rainfall outlook and local weather conditions to prepare before heavy rain sets in.",
    to: "/weather" as const,
    cta: "View Weather",
  },
  {
    icon: MapPin,
    title: "Explore communities",
    body: "Browse communities across Greater Accra and learn more about areas that may be vulnerable to flooding.",
    to: "/communities" as const,
    cta: "Explore Communities",
  },
] as const;

function Home() {
  return (
    <div className="overflow-hidden bg-slate-50">
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 54% at 50% 20%, oklch(0.47 0.16 258 / 0.82), transparent 56%), radial-gradient(44% 34% at 24% 84%, oklch(0.8 0.05 245 / 0.44), transparent 60%), linear-gradient(180deg, oklch(0.16 0.06 260) 0%, oklch(0.2 0.07 257) 46%, oklch(0.96 0.01 245) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent via-white/6 to-white/78"
        />

        <div className="relative mx-auto grid min-h-[40rem] max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10 lg:px-8 lg:pb-24 lg:pt-16">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm text-white/92 ring-1 ring-white/14 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-water shadow-[0_0_0_6px_rgba(43,110,255,0.16)]" />
              Flood preparedness for Greater Accra
            </div>

            <h1 className="mt-8 max-w-3xl text-3xl font-black leading-[1.02] tracking-[-0.05em] sm:text-4xl lg:text-5xl">
              Check flood risk in your community before heavy rain hits.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-white/92 lg:text-lg lg:leading-8">
              AccraFloodWatch helps you explore vulnerable communities, view current weather
              conditions, and check current flood risk so you can plan ahead with more confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/ai-predict"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-water px-5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-navy sm:h-12 sm:px-6 sm:text-base"
              >
                Check Current Risk <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/weather"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/34 bg-white/16 px-5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-navy sm:h-12 sm:px-6 sm:text-base"
              >
                View Weather
              </Link>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
              {heroHighlights.map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-2xl border border-white/18 bg-[rgba(7,19,58,0.28)] p-4 shadow-[0_10px_26px_rgba(9,18,52,0.12)] backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2 text-white/84">
                    <item.icon className="h-4 w-4 text-[#b9d4ff]" />
                    <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/82">
                      {item.label}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-black tracking-[-0.04em] text-white sm:text-xl">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-[58rem] lg:max-w-[41rem]">
              <div className="relative rounded-[2rem] bg-[#2454de] p-4 ring-1 ring-white/10 sm:rounded-[2.4rem] sm:p-6 lg:p-6 xl:p-7">
                <div className="min-h-[28rem] rounded-[1.75rem] bg-gradient-to-br from-[#275ff3] via-[#2559e6] to-[#1f4fca] p-5 sm:min-h-[30rem] sm:rounded-[2rem] sm:p-8 lg:min-h-[24rem] lg:p-7 xl:min-h-[25rem] xl:p-8">
                  <div className="mx-auto max-w-sm rounded-[1.5rem] border border-slate-200/85 bg-white/98 p-5 text-navy shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:rounded-[1.7rem] sm:p-6 lg:max-w-[33rem] lg:p-5 xl:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold sm:text-xl">Your flood prep toolkit</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Check the information you need most before, during, and after heavy rain.
                        </p>
                      </div>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-water-soft text-water shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:h-11 sm:w-11">
                        <Waves className="h-5 w-5" />
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-2">
                      {toolkitItems.map((item, index) => (
                        <div
                          key={item.title}
                          className={`min-w-0 rounded-2xl border border-slate-200/90 bg-slate-50/92 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] ${index === 2 ? "lg:col-span-2 lg:min-h-[6.75rem]" : "lg:min-h-[6.75rem]"}`}
                        >
                          <div>
                            <p className="text-sm font-semibold sm:text-base">{item.title}</p>
                            <p className="mt-1 text-sm leading-5 text-slate-600">{item.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Link
                      to="/ai-predict"
                      className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-water px-4 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:h-12 sm:text-base"
                    >
                      Check Current Risk
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.6rem] border border-slate-200/85 bg-white/98 p-5 text-navy shadow-[0_16px_36px_rgba(15,23,42,0.1)] lg:ml-8 lg:mt-5 lg:max-w-[20.5rem] lg:rounded-[1.8rem]">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-bold sm:text-lg">Plan early, act faster</p>
                    <p className="mt-2 text-sm leading-5 text-slate-600">
                      Keep flood conditions, weather, and local context within easy reach.
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-water text-white sm:h-12 sm:w-12">
                    <Activity className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="mx-auto max-w-4xl text-2xl font-black leading-[1.08] tracking-[-0.05em] text-navy sm:text-3xl lg:text-4xl">
            Flood preparation should start before roads become unsafe.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-navy/78 lg:text-lg lg:leading-8">
            Use AccraFloodWatch to check local conditions, follow the weather, and understand where
            flooding may be a concern across Greater Accra.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-medium text-navy/78 sm:text-base">
            {sectionChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-water/20 bg-water-soft px-4 py-2.5"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:px-8 xl:gap-12">
          <div className="pt-4 lg:max-w-[34rem] lg:pr-2">
            <h2 className="text-2xl font-black tracking-[-0.05em] text-navy sm:text-3xl lg:text-[2.6rem] lg:leading-[1.05]">
              What you can do with AccraFloodWatch
            </h2>
            <ul className="mt-6 space-y-4 text-base leading-7 text-navy/92 sm:text-lg sm:leading-8 lg:mt-7 lg:space-y-5 lg:text-[1.05rem]">
              {capabilityItems.map((item) => (
                <li key={item} className="flex gap-3 lg:gap-4">
                  <span className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full bg-water lg:h-2 lg:w-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:justify-self-end lg:w-full lg:max-w-[44rem]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2.4rem] sm:p-6 lg:p-5 xl:p-6">
              <div className="rounded-[2rem] bg-[#252525] p-4 sm:p-5 lg:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 lg:gap-4 xl:grid-cols-3">
                  {snapshotItems.map((item) => (
                    <div
                      key={item.title}
                      className="min-w-0 rounded-[1.3rem] border border-white/10 bg-[#25324c] p-4 text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] lg:min-h-[7.25rem] xl:min-h-[7.5rem]"
                    >
                      <div className="flex h-full min-h-[6.1rem] flex-col justify-between gap-4 lg:min-h-0">
                        <p className="text-sm font-semibold leading-5 text-white/88 lg:text-[0.95rem]">
                          {item.title}
                        </p>
                        <p className="text-base font-bold tracking-[-0.02em] text-white sm:text-lg lg:text-[1.2rem]">
                          {item.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[1.6rem] border border-blue-200 bg-white p-5 shadow-sm lg:mt-5 lg:w-full lg:rounded-[1.8rem]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold tracking-[-0.03em] text-navy lg:text-xl">
                      Start with the information you need most
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground lg:text-[0.95rem]">
                      Check current flood risk, follow the weather, and explore communities at your
                      own pace.
                    </p>
                  </div>
                  <Link
                    to="/ai-predict"
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-water px-4 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:h-11 sm:px-5"
                  >
                    Check Current Risk <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black tracking-[-0.05em] text-navy sm:text-3xl lg:text-4xl">
            How to use AccraFloodWatch
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {quickActionCards.map((item) => (
              <div
                key={item.title}
                className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300 sm:p-7"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-water-soft text-water">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-navy sm:text-xl">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-muted-foreground">{item.body}</p>
                <Link
                  to={item.to}
                  className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-water underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {item.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
