import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CloudRain, LifeBuoy, MapPin, Menu, ShieldAlert, Waves, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home" },
  { to: "/communities", label: "Communities" },
  { to: "/ai-predict", label: "Current Risk" },
  { to: "/weather", label: "Weather" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/help", label: "Help" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 sm:gap-3"
          onClick={() => setOpen(false)}
        >
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
          />
          <span className="truncate text-[1.15rem] font-black tracking-[-0.05em] text-water sm:text-[1.35rem] lg:text-[1.45rem]">
            AccraFloodWatch
          </span>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              activeProps={{ className: "bg-secondary text-navy" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-navy lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className={cn("border-t border-border bg-white lg:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-base font-medium text-muted-foreground hover:bg-secondary hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              activeProps={{ className: "bg-secondary text-navy" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function FooterLink({ to, children }: { to: (typeof links)[number]["to"]; children: string }) {
  return (
    <li>
      <Link to={to} className="text-sm text-navy-foreground/78 transition hover:text-white">
        {children}
      </Link>
    </li>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_2fr]">
          <div className="space-y-6">
            <div>
              <p className="text-3xl font-black tracking-[-0.06em] text-white">AccraFloodWatch</p>
              <p className="mt-4 max-w-sm text-sm leading-7 text-navy-foreground/76">
                AccraFloodWatch helps communities across Greater Accra check current flood risk,
                follow weather conditions, and prepare before heavy rain.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-water">
                  <ShieldAlert className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-white">Safety notice</p>
                  <p className="mt-1 text-sm text-navy-foreground/76">
                    For urgent flooding emergencies, follow official local alerts and emergency
                    services.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-navy-foreground/76">
                Use AccraFloodWatch to stay informed and prepare early, but always rely on official
                instructions during active emergencies.
              </p>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-base font-semibold text-white">Explore</p>
              <ul className="mt-5 space-y-4">
                <FooterLink to="/">Home</FooterLink>
                <FooterLink to="/communities">Communities</FooterLink>
                <FooterLink to="/weather">Weather</FooterLink>
                <FooterLink to="/how-it-works">How It Works</FooterLink>
              </ul>
            </div>

            <div>
              <p className="text-base font-semibold text-white">Tools</p>
              <ul className="mt-5 space-y-4">
                <FooterLink to="/ai-predict">Current Flood Risk</FooterLink>
                <FooterLink to="/help">Help & FAQs</FooterLink>
              </ul>
            </div>

            <div>
              <p className="text-base font-semibold text-white">Focus Areas</p>
              <ul className="mt-5 space-y-4 text-sm text-navy-foreground/78">
                <li className="flex items-center gap-2">
                  <CloudRain className="h-4 w-4 text-water" />
                  Rainfall outlook
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-water" />
                  Community monitoring
                </li>
                <li className="flex items-center gap-2">
                  <Waves className="h-4 w-4 text-water" />
                  Flood context
                </li>
                <li className="flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-water" />
                  Preparedness guidance
                </li>
              </ul>
            </div>

            <div>
              <p className="text-base font-semibold text-white">Start Here</p>
              <div className="mt-5 rounded-[1.6rem] border border-slate-200/80 bg-white p-5 text-navy shadow-[0_16px_36px_rgba(15,23,42,0.1)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-water">
                  Quick start
                </p>
                <p className="mt-3 text-base font-semibold sm:text-lg">
                  Check current flood risk in your community.
                </p>
                <Link
                  to="/ai-predict"
                  className="mt-5 inline-flex items-center rounded-2xl bg-water px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-water/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Check Current Risk
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-navy-foreground/60 md:flex-row md:items-center md:justify-between">
          <p>
            Community information, weather, and current flood risk in one place for Greater Accra.
          </p>
          <p>Copyright {new Date().getFullYear()} AccraFloodWatch</p>
        </div>
      </div>
    </footer>
  );
}
