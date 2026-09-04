import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ChevronDown, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help | AccraFloodWatch" },
      {
        name: "description",
        content: "Find quick answers about flood risk, weather, and using AccraFloodWatch.",
      },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  {
    q: "How do I check flood risk?",
    a: "Go to Current Risk, choose a community, and select Check Current Risk. The result will show the current flood-risk level for that area.",
  },
  {
    q: "What do Low, Moderate, and High mean?",
    a: "Low means conditions currently suggest lower flood concern. Moderate means there is increased flood concern and conditions should be monitored. High means flood concern is elevated and users should pay close attention to changing conditions and official guidance.",
  },
  {
    q: "What is community flood vulnerability?",
    a: "Community flood vulnerability reflects characteristics of an area that may make flooding more or less likely. It helps explain why some communities may be more affected than others.",
  },
  {
    q: "Why does weather affect current risk?",
    a: "Rainfall and near-term weather conditions can increase flood concern, especially during heavier rain. Current Risk uses this weather context when it is available.",
  },
  {
    q: "Why is weather unavailable for some communities?",
    a: "Weather information is not yet available for every community. Coverage is still limited in some areas.",
  },
  {
    q: "What happens if weather cannot be loaded?",
    a: "Try again shortly. If weather cannot be loaded, the available flood-vulnerability information may still be shown.",
  },
  {
    q: "Where can I view weather?",
    a: "Open the Weather page to check current conditions, expected rain, and the short-term outlook for supported communities.",
  },
  {
    q: "I can't find my community. What should I do?",
    a: "Search by community name and try nearby spellings if needed. Some locations may not yet be available in all features.",
  },
  {
    q: "Is AccraFloodWatch an official warning service?",
    a: "No. AccraFloodWatch is an information and awareness tool. It does not replace official emergency alerts, warnings, or guidance.",
  },
];

function HelpPage() {
  return (
    <div className="bg-slate-50">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-water">Help</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-navy sm:text-5xl lg:text-5xl">
            Help & FAQs
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Find quick answers about flood risk, weather, and using AccraFloodWatch.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-navy p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[#7fb4ff]" />
              <h2 className="text-2xl font-bold tracking-[-0.04em]">Safety notice</h2>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-white/78">
              <p>
                AccraFloodWatch supports awareness and planning, but conditions can change quickly.
              </p>
              <p>
                Follow official emergency and weather guidance where relevant. This website does not
                replace emergency services.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <LifeBuoy className="h-5 w-5 text-water" />
              <h2 className="text-2xl font-bold tracking-[-0.04em] text-navy">Quick actions</h2>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Link
                to="/ai-predict"
                className="rounded-[1.1rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-slate-50"
              >
                Check Current Risk
              </Link>
              <Link
                to="/weather"
                className="rounded-[1.1rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-slate-50"
              >
                View Weather
              </Link>
              <Link
                to="/communities"
                className="rounded-[1.1rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-slate-50"
              >
                Explore Communities
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-[1.1rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-slate-50"
              >
                Learn How Risk Is Calculated
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-navy">
            Frequently asked questions
          </h2>
          <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            {faqs.map((faq, index) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} defaultOpen={index === 0} />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-semibold text-navy">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="px-6 pb-6 text-sm leading-7 text-muted-foreground">{a}</p>}
    </div>
  );
}
