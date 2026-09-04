import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CloudOff,
  CloudRain,
  Droplets,
  Loader2,
  Thermometer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getCommunityWeather,
  getWeatherCommunities,
  type CommunityWeather,
  type WeatherCommunity,
} from "@/lib/weather.functions";
import { cn } from "@/lib/utils";

const DEFAULT_WEATHER_TIMEZONE = "Africa/Accra";

export const Route = createFileRoute("/weather")({
  head: () => ({
    meta: [
      { title: "Weather | AccraFloodWatch" },
      {
        name: "description",
        content:
          "View current weather conditions and short-term rainfall outlooks for supported communities across Greater Accra.",
      },
    ],
  }),
  component: WeatherPage,
});

function WeatherPage() {
  const loadCommunities = useServerFn(getWeatherCommunities);
  const loadWeather = useServerFn(getCommunityWeather);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const [communityListLoading, setCommunityListLoading] = useState(true);
  const [communityListError, setCommunityListError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherUnavailable, setWeatherUnavailable] = useState<string | null>(null);
  const [allCommunities, setAllCommunities] = useState<WeatherCommunity[]>([]);
  const [selectedCommunitySlug, setSelectedCommunitySlug] = useState("");
  const [weather, setWeather] = useState<CommunityWeather | null>(null);

  useEffect(() => {
    let active = true;

    async function hydrateCommunities() {
      setCommunityListLoading(true);
      setCommunityListError(null);

      try {
        const response = await loadCommunities();
        if (!active) return;
        setAllCommunities(response);
      } catch (error) {
        if (!active) return;
        setAllCommunities([]);
        setCommunityListError(
          error instanceof Error
            ? error.message
            : "Unable to load supported communities right now.",
        );
      } finally {
        if (active) {
          setCommunityListLoading(false);
        }
      }
    }

    hydrateCommunities();

    return () => {
      active = false;
    };
  }, [loadCommunities]);

  const supportedCommunities = useMemo(
    () => allCommunities.filter((community) => community.weatherAvailable),
    [allCommunities],
  );
  const unsupportedCommunities = useMemo(
    () => allCommunities.filter((community) => !community.weatherAvailable),
    [allCommunities],
  );
  const selectedCommunity = useMemo(
    () => allCommunities.find((community) => community.slug === selectedCommunitySlug) ?? null,
    [allCommunities, selectedCommunitySlug],
  );

  useEffect(() => {
    if (!selectedCommunitySlug || !selectedCommunity?.weatherAvailable) {
      setWeather(null);
      setWeatherLoading(false);
      if (!selectedCommunitySlug) {
        setWeatherError(null);
        setWeatherUnavailable(null);
      }
      return;
    }

    let active = true;

    async function hydrateWeather() {
      setWeatherLoading(true);
      setWeatherError(null);
      setWeatherUnavailable(null);
      setWeather(null);

      try {
        const response = await loadWeather({ data: { communitySlug: selectedCommunitySlug } });
        if (!active) return;
        setWeather(response);
      } catch (error) {
        if (!active) return;

        const message = error instanceof Error ? error.message : "Unable to load live weather.";
        if (message === "Weather information is not yet available for this community.") {
          setWeatherUnavailable(message);
          setWeatherError(null);
        } else {
          setWeatherError(message);
          setWeatherUnavailable(null);
        }
      } finally {
        if (active) {
          setWeatherLoading(false);
        }
      }
    }

    hydrateWeather();

    return () => {
      active = false;
    };
  }, [loadWeather, selectedCommunity, selectedCommunitySlug]);

  const supportedCount = supportedCommunities.length;
  const totalCount = allCommunities.length;
  const unsupportedCount = Math.max(totalCount - supportedCount, 0);

  return (
    <div className="bg-slate-50">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-water">
              Weather outlook
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-navy sm:text-5xl lg:text-5xl">
              Weather
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Choose a community to view current conditions, expected rain, and the short-term
              outlook across Greater Accra.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-5 xl:gap-6">
          <aside className="space-y-5 rounded-[2rem] border border-blue-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
            <Field label="Select a community">
              <Popover open={communityMenuOpen} onOpenChange={setCommunityMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={communityMenuOpen}
                    disabled={communityListLoading || !!communityListError || totalCount === 0}
                    className="h-14 w-full justify-between rounded-[1.1rem] border-border bg-background px-4 text-left text-sm font-normal text-foreground hover:bg-background"
                  >
                    <span className="truncate">
                      {selectedCommunity?.name ??
                        (communityListLoading ? "Loading communities..." : "Choose a community")}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search communities..." />
                    <CommandList>
                      <CommandEmpty>No matching community found.</CommandEmpty>
                      <CommandGroup heading={`Weather available (${supportedCount})`}>
                        {supportedCommunities.map((community) => (
                          <CommandItem
                            key={community.slug}
                            value={`${community.name} ${community.slug}`}
                            onSelect={() => {
                              setSelectedCommunitySlug(community.slug);
                              setCommunityMenuOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                community.slug === selectedCommunitySlug
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{community.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                Weather available
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {unsupportedCommunities.length > 0 && (
                        <CommandGroup heading={`Weather not yet available (${unsupportedCount})`}>
                          {unsupportedCommunities.map((community) => (
                            <CommandItem
                              key={community.slug}
                              value={`${community.name} ${community.slug}`}
                              disabled
                            >
                              <CloudOff className="h-4 w-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{community.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Weather not yet available
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            {communityListLoading && (
              <StatusCard
                icon={<Loader2 className="h-4 w-4 animate-spin text-water" />}
                title="Loading communities"
                tone="neutral"
              >
                Getting the latest community weather options...
              </StatusCard>
            )}

            {communityListError && (
              <StatusCard
                icon={<AlertTriangle className="h-4 w-4 text-risk-high" />}
                title="Communities could not be loaded"
                tone="error"
              >
                {communityListError}
              </StatusCard>
            )}

            {!communityListLoading && !communityListError && supportedCount === 0 && (
              <StatusCard
                icon={<CloudOff className="h-4 w-4 text-risk-moderate" />}
                title="Weather information is not available yet"
                tone="warning"
              >
                Weather information is not available for any communities right now.
              </StatusCard>
            )}

            <div className="rounded-[1.7rem] border border-water/20 bg-water-soft p-5 text-sm text-navy shadow-sm">
              <p className="font-semibold">Weather availability</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <StatChip label="Communities" value={`${totalCount || 0}`} />
                <StatChip label="Weather available" value={`${supportedCount}`} />
                <StatChip label="Not yet available" value={`${unsupportedCount}`} />
              </div>
              <p className="mt-4 leading-7 text-muted-foreground">
                Communities without weather coverage still appear in the list so you can quickly see
                where live weather is already available.
              </p>
            </div>
          </aside>

          <div className="space-y-5 sm:space-y-6 lg:col-span-3">
            {!selectedCommunitySlug && !communityListLoading && !communityListError && (
              <EmptyStateCard />
            )}

            {selectedCommunity && !selectedCommunity.weatherAvailable && (
              <StatusCard
                icon={<CloudOff className="h-4 w-4 text-risk-moderate" />}
                title="Weather not yet available"
                tone="warning"
              >
                Weather information is not yet available for this community.
              </StatusCard>
            )}

            {weatherLoading && (
              <div className="grid min-h-[240px] place-items-center rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm sm:min-h-[320px] sm:p-8">
                <div>
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-water" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Loading weather for {selectedCommunity?.name}...
                  </p>
                </div>
              </div>
            )}

            {weatherUnavailable && !weatherLoading && (
              <StatusCard
                icon={<CloudOff className="h-4 w-4 text-risk-moderate" />}
                title="Weather information is not available yet"
                tone="warning"
              >
                {weatherUnavailable}
              </StatusCard>
            )}

            {weatherError && !weatherLoading && (
              <StatusCard
                icon={<AlertTriangle className="h-4 w-4 text-risk-high" />}
                title="Weather information could not be loaded"
                tone="error"
              >
                {weatherError}
              </StatusCard>
            )}

            {weather && !weatherLoading && (
              <>
                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold tracking-[-0.04em] text-navy sm:text-2xl">
                        Rainfall outlook
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                        See how much rain is expected soon for {weather.communityName}, then use the
                        supporting forecast details below for added context.
                      </p>
                    </div>
                    <div className="inline-flex rounded-full border border-water/20 bg-water-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-water">
                      Short-term forecast
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <RainfallHighlightCard
                      label="Expected rainfall"
                      timeframe="Next 6 hours"
                      value={`${weather.next6h.rainSumMm.toFixed(1)} mm`}
                    />
                    <RainfallHighlightCard
                      label="Expected rainfall"
                      timeframe="Next 24 hours"
                      value={`${weather.next24h.rainSumMm.toFixed(1)} mm`}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
                    <StatChip
                      label="Highest precipitation chance - next 6 hours"
                      value={`${weather.modelWeatherFeatures.precipProbability6hMax.toFixed(0)}%`}
                    />
                    <div className="rounded-[1.4rem] border border-border bg-background px-4 py-4 text-sm leading-7 text-muted-foreground">
                      Nearby communities may sometimes show similar forecasts because regional
                      weather models cover areas larger than individual neighbourhoods.
                    </div>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-navy p-5 text-white shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                        Current conditions
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] sm:text-3xl">
                        {weather.communityName}
                      </h2>
                      <p className="mt-3 text-sm text-white/70">
                        Updated {formatDateTime(weather.generatedAt, weather.location.timezone)}
                      </p>
                    </div>
                    <div className="w-full rounded-[1.4rem] bg-white/10 px-4 py-3 text-left backdrop-blur sm:w-auto sm:text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                        Latest reading
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatDateTime(weather.current.time, weather.location.timezone)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <LiveMetric
                      label="Current temperature"
                      value={`${weather.current.temperatureC.toFixed(1)} C`}
                      icon={<Thermometer className="h-4 w-4 text-[#7fb4ff]" />}
                    />
                    <LiveMetric
                      label="Rain in previous hour"
                      value={`${weather.current.rainMm.toFixed(1)} mm`}
                      icon={<Droplets className="h-4 w-4 text-[#7fb4ff]" />}
                    />
                    <LiveMetric
                      label="Precipitation chance"
                      value={`${weather.current.precipitationProbabilityPct.toFixed(0)}%`}
                      icon={<CloudRain className="h-4 w-4 text-[#7fb4ff]" />}
                    />
                  </div>
                </section>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold tracking-[-0.04em] text-navy sm:text-2xl">
                        Hourly forecast
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A quick look at changing conditions through the day.
                      </p>
                    </div>
                    <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                      {weather.hourlyPreview.length} hourly entries
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 lg:hidden">
                    {weather.hourlyPreview.map((entry) => (
                      <HourlyForecastCard
                        key={entry.time}
                        time={formatHourLabel(entry.time, weather.location.timezone)}
                        temperature={`${entry.temperatureC.toFixed(1)} C`}
                        precipitation={`${entry.precipitationProbabilityPct.toFixed(0)}%`}
                        rain={`${entry.rainMm.toFixed(1)} mm`}
                      />
                    ))}
                  </div>

                  <div className="mt-5 hidden overflow-x-auto lg:block">
                    <div className="grid min-w-[860px] grid-cols-[1.3fr_repeat(3,minmax(140px,1fr))] gap-3">
                      <ForecastTableHeader label="Local time" />
                      <ForecastTableHeader label="Temperature" />
                      <ForecastTableHeader label="Precipitation chance" />
                      <ForecastTableHeader label="Rainfall" />
                      {weather.hourlyPreview.map((entry) => (
                        <ForecastRow
                          key={entry.time}
                          time={formatHourLabel(entry.time, weather.location.timezone)}
                          temperature={`${entry.temperatureC.toFixed(1)} C`}
                          precipitation={`${entry.precipitationProbabilityPct.toFixed(0)}%`}
                          rain={`${entry.rainMm.toFixed(1)} mm`}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="text-xl font-bold tracking-[-0.04em] text-navy sm:text-2xl">
                      Forecast guidance
                    </h3>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                      <p>
                        Expected rainfall totals help you see how much rain may arrive soon, while
                        precipitation chance adds supporting context for the forecast window.
                      </p>
                      <p>
                        Use the hourly forecast to follow changing conditions through the day and
                        the Current Risk page to see how weather and local vulnerability are read
                        together.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="text-xl font-bold tracking-[-0.04em] text-navy">What next?</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      Want to see what these conditions may mean for flooding in your community?
                    </p>
                    <Link
                      to="/ai-predict"
                      className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[1.1rem] bg-water px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 sm:w-auto"
                    >
                      Check Current Risk
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    <p className="mt-6 text-xs leading-6 text-muted-foreground">
                      Weather data provided by Open-Meteo.
                    </p>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function EmptyStateCard() {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-[2rem] border border-dashed border-slate-200 bg-white p-6 text-center shadow-sm sm:min-h-[320px] sm:p-8">
      <div>
        <CloudRain className="mx-auto h-9 w-9 text-water" />
        <p className="mt-4 text-sm text-muted-foreground">
          Choose a community to view the latest weather conditions and short-term outlook.
        </p>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "neutral" | "warning" | "error";
  children: React.ReactNode;
}) {
  const toneClassName =
    tone === "error"
      ? "border-risk-high/25 bg-risk-high-soft"
      : tone === "warning"
        ? "border-risk-moderate/25 bg-risk-moderate-soft"
        : "border-border bg-white";

  return (
    <div className={cn("rounded-[1.7rem] border p-4 text-sm sm:p-5", toneClassName)}>
      <div className="flex items-center gap-2 text-navy">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-3 leading-7 text-muted-foreground">{children}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-border bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-5 text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-navy">{value}</p>
    </div>
  );
}

function LiveMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] bg-white/8 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function RainfallHighlightCard({
  label,
  timeframe,
  value,
}: {
  label: string;
  timeframe: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-water/20 bg-[#f8fbff] px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-water">{label}</p>
      <p className="mt-3 text-sm font-semibold text-navy">{timeframe}</p>
      <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-navy sm:text-4xl">{value}</p>
    </div>
  );
}

function HourlyForecastCard({
  time,
  temperature,
  precipitation,
  rain,
}: {
  time: string;
  temperature: string;
  precipitation: string;
  rain: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200/80 bg-background p-4">
      <p className="text-sm font-semibold text-navy">{time}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-[1rem] border border-border bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Temp
          </p>
          <p className="mt-1 text-sm font-semibold text-navy">{temperature}</p>
        </div>
        <div className="rounded-[1rem] border border-border bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Precipitation chance
          </p>
          <p className="mt-1 text-sm font-semibold text-navy">{precipitation}</p>
        </div>
        <div className="rounded-[1rem] border border-border bg-white px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Rainfall
          </p>
          <p className="mt-1 text-sm font-semibold text-navy">{rain}</p>
        </div>
      </div>
    </div>
  );
}

function ForecastTableHeader({ label }: { label: string }) {
  return (
    <div className="rounded-[1rem] bg-secondary px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
    </div>
  );
}

function ForecastRow({
  time,
  temperature,
  precipitation,
  rain,
}: {
  time: string;
  temperature: string;
  precipitation: string;
  rain: string;
}) {
  return (
    <>
      <div className="rounded-[1rem] border border-border bg-background px-4 py-3 text-sm font-medium text-navy">
        {time}
      </div>
      <div className="rounded-[1rem] border border-border bg-background px-4 py-3 text-sm text-navy">
        {temperature}
      </div>
      <div className="rounded-[1rem] border border-border bg-background px-4 py-3 text-sm text-navy">
        {precipitation}
      </div>
      <div className="rounded-[1rem] border border-border bg-background px-4 py-3 text-sm text-navy">
        {rain}
      </div>
    </>
  );
}

function formatDateTime(value: string, timezone: string = DEFAULT_WEATHER_TIMEZONE) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatHourLabel(value: string, timezone: string = DEFAULT_WEATHER_TIMEZONE) {
  return new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}
