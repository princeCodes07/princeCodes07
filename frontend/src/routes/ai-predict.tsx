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
  Gauge,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  getMlCommunities,
  predictCurrentFloodRisk,
  type CurrentFloodRiskPrediction,
  type MlCommunity,
  type WeatherRiskLevel,
} from "@/lib/ml-predict.functions";
import { riskLabel } from "@/lib/flood-data";
import { RiskBadge, RiskBar } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-predict")({
  head: () => ({
    meta: [
      { title: "Current Flood Risk | AccraFloodWatch" },
      {
        name: "description",
        content:
          "Check current flood risk for communities across Greater Accra with supporting weather information and flood-vulnerability context.",
      },
    ],
  }),
  component: AiPredictPage,
});

function AiPredictPage() {
  const loadCommunities = useServerFn(getMlCommunities);
  const predict = useServerFn(predictCurrentFloodRisk);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const [communityListLoading, setCommunityListLoading] = useState(true);
  const [communityListError, setCommunityListError] = useState<string | null>(null);
  const [mlCommunities, setMlCommunities] = useState<MlCommunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CurrentFloodRiskPrediction | null>(null);
  const [communitySlug, setCommunitySlug] = useState("");

  useEffect(() => {
    let active = true;

    async function hydrateCommunities() {
      setCommunityListLoading(true);
      setCommunityListError(null);

      try {
        const response = await loadCommunities();
        if (!active) return;

        setMlCommunities(response);
        setCommunitySlug((currentSlug) => {
          if (currentSlug && response.some((community) => community.slug === currentSlug)) {
            return currentSlug;
          }
          return response[0]?.slug ?? "";
        });
      } catch (err) {
        if (!active) return;
        setMlCommunities([]);
        setCommunitySlug("");
        setCommunityListError(
          err instanceof Error
            ? err.message
            : "Unable to load the flood-risk community list right now.",
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

  const selectedMlCommunity = useMemo(
    () => mlCommunities.find((community) => community.slug === communitySlug) ?? null,
    [communitySlug, mlCommunities],
  );

  const weatherSupportedCount = useMemo(
    () => mlCommunities.filter((community) => community.weatherAvailable).length,
    [mlCommunities],
  );

  const hasCommunityOptions = mlCommunities.length > 0;
  const canSubmit =
    !communityListLoading &&
    !loading &&
    hasCommunityOptions &&
    !!selectedMlCommunity &&
    !communityListError;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedMlCommunity) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await predict({ data: { communitySlug: selectedMlCommunity.slug } });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-50">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-water">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.22em]">
              Current risk check
            </span>
          </div>
          <div className="mt-4 max-w-4xl">
            <h1 className="text-4xl font-black tracking-[-0.05em] text-navy sm:text-5xl lg:text-5xl">
              Check current flood risk
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              Choose your community to see the current flood outlook, weather impact, and supporting
              flood-vulnerability details.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm lg:col-span-2"
          >
            <Field label="Select a community">
              <Popover open={communityMenuOpen} onOpenChange={setCommunityMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={communityMenuOpen}
                    disabled={communityListLoading || !!communityListError || !hasCommunityOptions}
                    className="h-14 w-full justify-between rounded-[1.1rem] border-border bg-background px-4 text-left text-sm font-normal text-foreground hover:bg-background"
                  >
                    <span className="truncate">
                      {communityListLoading
                        ? "Loading communities..."
                        : (selectedMlCommunity?.name ?? "Select a community")}
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
                      {mlCommunities.map((community) => (
                        <CommandItem
                          key={community.slug}
                          value={`${community.name} ${community.slug}`}
                          onSelect={() => {
                            setCommunitySlug(community.slug);
                            setCommunityMenuOpen(false);
                            setError(null);
                            setResult(null);
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              community.slug === communitySlug ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{community.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {community.weatherAvailable
                                ? "Weather available"
                                : "Weather currently unavailable"}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>

            {communityListLoading && (
              <div className="rounded-[1.7rem] border border-border bg-background p-5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-navy">
                  <Loader2 className="h-4 w-4 animate-spin text-water" />
                  Loading communities...
                </div>
              </div>
            )}

            {communityListError && (
              <div className="rounded-[1.7rem] border border-risk-high/25 bg-risk-high-soft p-5 text-sm text-risk-high">
                <p className="font-semibold">Community list unavailable</p>
                <p className="mt-2 leading-7">{communityListError}</p>
              </div>
            )}

            {!communityListLoading && !communityListError && !hasCommunityOptions && (
              <div className="rounded-[1.7rem] border border-border bg-background p-5 text-sm text-muted-foreground">
                No communities are available to check right now.
              </div>
            )}

            {selectedMlCommunity && (
              <div className="rounded-[1.7rem] border border-border bg-background p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Selected community
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-navy">
                      {selectedMlCommunity.name}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 inline-flex rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-navy">
                  {selectedMlCommunity.weatherAvailable
                    ? "Weather available"
                    : "Live weather is not available for this community right now"}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1.15rem] bg-water px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking current flood risk...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Check Current Risk
                </>
              )}
            </button>
          </form>

          <div className="lg:col-span-3">
            {error && (
              <div className="flex items-start gap-3 rounded-[1.6rem] border border-risk-high/40 bg-risk-high-soft p-5 text-sm text-risk-high">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p>{error}</p>
              </div>
            )}

            {!result && !error && (
              <div className="grid min-h-[340px] place-items-center rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
                <div>
                  <Sparkles className="mx-auto h-9 w-9 text-water" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Select a community and check current flood risk to see the result here.
                  </p>
                </div>
              </div>
            )}

            {result && <ResultCard result={result} />}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-[1.7rem] border border-water/20 bg-water-soft p-5 text-sm text-navy shadow-sm">
            <p className="font-semibold">How this result is presented</p>
            <p className="mt-2 leading-7 text-muted-foreground">
              Current flood risk considers community flood vulnerability together with current
              weather conditions where available.
            </p>
          </div>

          <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-navy">
              <Info className="h-4 w-4 text-water" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                Available communities
              </p>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Search the available community list and check current flood conditions in a few
              clicks.
            </p>
            {!communityListLoading && hasCommunityOptions && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex rounded-full border border-border bg-white px-3 py-1">
                  {mlCommunities.length} communities available
                </span>
                <span className="inline-flex rounded-full border border-border bg-white px-3 py-1">
                  {weatherSupportedCount} with weather available
                </span>
              </div>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[1.2rem] border border-border bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] leading-5 text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-bold text-navy">{value}</p>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-navy">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatusPanel({
  icon,
  title,
  body,
  tone = "info",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "info" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "border-risk-high/30 bg-risk-high-soft text-risk-high"
      : "border-water/25 bg-water-soft text-navy";

  return (
    <div className={cn("flex items-start gap-3 rounded-[1.6rem] border p-5 text-sm", toneClass)}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-2 leading-7">{body}</p>
      </div>
    </div>
  );
}

function WeatherRiskPill({ weatherRisk }: { weatherRisk: WeatherRiskLevel }) {
  const styles: Record<WeatherRiskLevel, string> = {
    low: "border-risk-low/30 bg-risk-low-soft text-navy",
    elevated: "border-risk-moderate/30 bg-risk-moderate-soft text-navy",
    high: "border-risk-high/30 bg-risk-high-soft text-risk-high",
    severe: "border-risk-high/40 bg-risk-high text-white",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        styles[weatherRisk],
      )}
    >
      {titleCase(weatherRisk)}
    </span>
  );
}

function getRiskCautionMessage(riskLevel: CurrentFloodRiskPrediction["currentRisk"]["riskLevel"]) {
  switch (riskLevel) {
    case "high":
      return "Keep valuables off the floor, know your safest route, and monitor official flood and weather alerts closely.";
    case "moderate":
      return "Stay alert during heavy rain and keep household drainage clear where it is safe to do so.";
    case "low":
    default:
      return "Flooding under normal rainfall is less likely, but maintain drainage and remain aware of changing weather.";
  }
}

function ResultCard({ result }: { result: CurrentFloodRiskPrediction }) {
  const weatherEvaluated = result.method === "hybrid_rule_adjusted" && result.weather.available;
  const adjustmentPoints = result.weather.adjustmentPercentagePoints ?? 0;
  const triggeredBy = result.weather.triggeredBy;

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-navy p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Current flood risk
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{result.communityName}</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">{buildRiskSummary(result)}</p>
          </div>
          <RiskBadge
            percent={result.currentRisk.riskPercent}
            level={result.currentRisk.riskLevel}
          />
        </div>

        <div className="mt-6 rounded-[1.7rem] border border-blue-200 bg-white p-6 text-navy shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Current flood risk
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-5xl font-black tracking-[-0.05em] sm:text-[3.5rem]">
                {result.currentRisk.riskPercent}%
              </span>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {riskLabel(result.currentRisk.riskLevel)}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {getRiskCautionMessage(result.currentRisk.riskLevel)}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Current likelihood: {formatProbability(result.currentRisk.probability)}</p>
            </div>
          </div>
          <RiskBar percent={result.currentRisk.riskPercent} className="mt-4 h-3" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Community flood vulnerability"
              value={`${result.baseline.riskPercent}% - ${riskLabel(result.baseline.riskLevel)}`}
            />
            <MetricCard
              label="Weather impact"
              value={formatWeatherImpactSummary(result, weatherEvaluated, adjustmentPoints)}
            />
            <MetricCard label="Conditions" value={formatMethodLabel(result.method)} />
          </div>
        </div>
      </div>

      {result.method === "baseline_only" && (
        <StatusPanel
          icon={<CloudOff className="h-4 w-4 text-risk-moderate" />}
          title="Live weather is not available for this community right now"
          body="The flood risk shown is based on community flood vulnerability."
        />
      )}

      {result.method === "baseline_only_weather_unavailable" && (
        <StatusPanel
          icon={<CloudOff className="h-4 w-4 text-risk-high" />}
          title="Live weather could not be retrieved right now"
          body="The available flood-risk information is still shown below."
          tone="warning"
        />
      )}

      {weatherEvaluated && result.weather.weatherRisk === "low" && (
        <StatusPanel
          icon={<CloudRain className="h-4 w-4 text-water" />}
          title="Weather impact is currently low"
          body="Current weather conditions are not increasing the flood-risk level beyond the community's usual vulnerability."
        />
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard icon={<Gauge className="h-4 w-4" />} title="Community flood vulnerability">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-4xl font-black tracking-[-0.04em] text-navy">
                {result.baseline.riskPercent}%
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A general view of how vulnerable this community may be to flooding before current
                weather conditions are considered.
              </p>
            </div>
            <RiskBadge percent={result.baseline.riskPercent} level={result.baseline.riskLevel} />
          </div>
          <RiskBar percent={result.baseline.riskPercent} className="mt-4 h-3" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Risk level" value={riskLabel(result.baseline.riskLevel)} />
            <MetricCard
              label="Estimated likelihood"
              value={formatProbability(result.baseline.probability)}
            />
          </div>
        </SectionCard>

        <SectionCard icon={<CloudRain className="h-4 w-4" />} title="Weather impact">
          {weatherEvaluated && result.weather.weatherRisk ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Short-term rainfall and precipitation forecasts are considered alongside the
                    community's underlying flood vulnerability.
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-navy">
                    {titleCase(result.weather.weatherRisk)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {adjustmentPoints > 0
                      ? `This weather pattern is adding ${adjustmentPoints} percentage points to the current risk.`
                      : "Current weather conditions are not increasing the displayed risk."}
                  </p>
                </div>
                <WeatherRiskPill weatherRisk={result.weather.weatherRisk} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Expected rain - next 6 hours"
                  value={formatMillimeters(result.weather.rain6hSumMm)}
                />
                <MetricCard
                  label="Expected rain - next 24 hours"
                  value={formatMillimeters(result.weather.rain24hSumMm)}
                />
                <MetricCard
                  label="Highest precipitation chance - next 6 hours"
                  value={formatPercentValue(result.weather.precipProbability6hMax)}
                />
                <MetricCard
                  label="Weather impact level"
                  value={titleCase(result.weather.weatherRisk)}
                />
              </div>

              {triggeredBy.length > 0 ? (
                <div className="rounded-[1.2rem] border border-border bg-background p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-navy">What is driving the weather impact:</p>
                  <ul className="mt-3 space-y-2">
                    {triggeredBy.map((trigger) => (
                      <li key={trigger} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-water" />
                        <span>{formatWeatherTrigger(trigger)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-border bg-background p-4 text-sm text-muted-foreground">
                  Current weather conditions are not increasing flood risk right now.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <div>
                  {result.weatherContext && (
                    <>
                      <p>Forecast reference time: {result.weatherContext.forecastReferenceTime}</p>
                      <p>Generated at: {result.weatherContext.generatedAt}</p>
                    </>
                  )}
                </div>
                <Link
                  to="/weather"
                  className="inline-flex items-center gap-1 text-water hover:underline"
                >
                  View weather details
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-7 text-muted-foreground">
                {result.method === "baseline_only"
                  ? "Live weather is not available for this community right now. The risk shown is based on community flood vulnerability."
                  : "Live weather could not be retrieved right now. The available flood-risk information is still shown below."}
              </p>
              {result.weather.reason && (
                <div className="rounded-[1.2rem] border border-border bg-background p-4 text-sm text-muted-foreground">
                  {result.weather.reason}
                </div>
              )}
              <Link
                to="/weather"
                className="inline-flex items-center gap-1 text-water hover:underline"
              >
                View weather page
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard icon={<Info className="h-4 w-4" />} title="How risk is calculated">
        <div className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            Current risk considers community flood vulnerability together with current weather
            conditions where available.
          </p>
          <Link
            to="/how-it-works"
            className="inline-flex items-center gap-1 text-water hover:underline"
          >
            Learn how risk is calculated
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </SectionCard>

      <div className="grid gap-5 md:grid-cols-1">
        <SectionCard icon={<Gauge className="h-4 w-4" />} title="Community characteristics">
          <div className="grid gap-3">
            <MetricCard
              label="Elevation"
              value={`${result.baselineFeatures.elevationM.toFixed(2)} m`}
            />
            <MetricCard
              label="Slope"
              value={`${result.baselineFeatures.slopeDeg.toFixed(4)} deg`}
            />
            <MetricCard
              label="Drainage density"
              value={result.baselineFeatures.drainageDensity.toFixed(4)}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatProbability(probability: number) {
  return `${(probability * 100).toFixed(2)}%`;
}

function formatPercentValue(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(1)}%`;
}

function formatMillimeters(value: number | null) {
  return value === null ? "Unavailable" : `${value.toFixed(1)} mm`;
}

function formatMethodLabel(method: CurrentFloodRiskPrediction["method"]) {
  if (method === "hybrid_rule_adjusted") {
    return "Weather included";
  }
  if (method === "baseline_only") {
    return "Weather unavailable";
  }
  return "Weather temporarily unavailable";
}

function formatWeatherTrigger(trigger: string) {
  const match = trigger.match(/^([a-z0-9_]+)\s*(>=|<=|>|<)\s*([0-9.]+)$/i);
  if (!match) {
    return trigger;
  }

  const [, field, operator, threshold] = match;
  const labelMap: Record<string, string> = {
    precip_probability_6h_max: "Highest precipitation chance - next 6 hours",
    rain_6h_sum_mm: "Rain next 6h",
    rain_24h_sum_mm: "Rain next 24h",
  };

  const label = labelMap[field] ?? field.replace(/_/g, " ");
  const unit = field.includes("probability") ? "%" : field.includes("_mm") ? " mm" : "";

  return `${label} ${operator} ${threshold}${unit}`;
}

function formatWeatherImpactSummary(
  result: CurrentFloodRiskPrediction,
  weatherEvaluated: boolean,
  adjustmentPoints: number,
) {
  if (!weatherEvaluated) {
    return "Unavailable";
  }

  if (adjustmentPoints <= 0) {
    return "Low";
  }

  return `${titleCase(result.weather.weatherRisk ?? "low")} (+${adjustmentPoints} pts)`;
}

function buildRiskSummary(result: CurrentFloodRiskPrediction) {
  const level = riskLabel(result.currentRisk.riskLevel).toLowerCase();

  if (result.method === "baseline_only") {
    return `Flood risk is currently ${level} for ${result.communityName}. Live weather is not available for this community right now.`;
  }

  if (result.method === "baseline_only_weather_unavailable") {
    return `Flood risk is currently ${level} for ${result.communityName}. Live weather could not be retrieved right now.`;
  }

  return `Flood risk is currently ${level} for ${result.communityName}. Stay aware of changing weather conditions, especially during heavier rainfall.`;
}
