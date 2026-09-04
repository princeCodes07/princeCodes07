import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  communitySlug: z.string().min(1),
});

const RiskLevelSchema = z.enum(["low", "moderate", "high"]);
const WeatherRiskLevelSchema = z.enum(["low", "elevated", "high", "severe"]);
const PredictionMethodSchema = z.enum([
  "hybrid_rule_adjusted",
  "baseline_only",
  "baseline_only_weather_unavailable",
]);

const FeatureSchema = z.object({
  elevation_m: z.number(),
  slope_deg: z.number(),
  drainage_density: z.number(),
});

const CommunityListSchema = z.array(
  z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    weather_available: z.boolean(),
  }),
);

const ProbabilitySummarySchema = z.object({
  probability: z.number().min(0).max(1),
  risk_percent: z.number().min(0).max(100),
  risk_level: RiskLevelSchema,
});

const WeatherAdjustmentSchema = z.object({
  available: z.boolean(),
  reason: z.string().nullable().optional(),
  precip_probability_6h_max: z.number().nullable().optional(),
  rain_6h_sum_mm: z.number().nullable().optional(),
  rain_24h_sum_mm: z.number().nullable().optional(),
  weather_risk: WeatherRiskLevelSchema.nullable().optional(),
  adjustment: z.number().nullable().optional(),
  adjustment_percentage_points: z.number().int().nullable().optional(),
  triggered_by: z.array(z.string()).nullable().optional(),
});

const WeatherContextSchema = z.object({
  generated_at: z.string().min(1),
  forecast_reference_time: z.string().min(1),
});

const CurrentRiskApiResponseSchema = z.object({
  community_slug: z.string().min(1),
  community_name: z.string().min(1),
  source_town: z.string().min(1),
  baseline: ProbabilitySummarySchema,
  baseline_features: FeatureSchema,
  weather: WeatherAdjustmentSchema,
  weather_context: WeatherContextSchema.nullable().optional(),
  current_risk: ProbabilitySummarySchema,
  method: PredictionMethodSchema,
});

const CommunityPredictionApiResponseSchema = z.object({
  flood_probability: z.number().min(0).max(1),
  risk_percent: z.number().min(0).max(100),
  risk_level: RiskLevelSchema,
  features: FeatureSchema,
  community_slug: z.string().min(1),
  community_name: z.string().min(1),
  source_town: z.string().min(1),
});

export type FloodRiskLevel = z.infer<typeof RiskLevelSchema>;
export type WeatherRiskLevel = z.infer<typeof WeatherRiskLevelSchema>;
export type CurrentRiskMethod = z.infer<typeof PredictionMethodSchema>;

export type MlCommunity = {
  slug: string;
  name: string;
  weatherAvailable: boolean;
};

export type ProbabilitySummary = {
  probability: number;
  riskPercent: number;
  riskLevel: FloodRiskLevel;
};

export type BaselineFeatures = {
  elevationM: number;
  slopeDeg: number;
  drainageDensity: number;
};

export type CurrentFloodRiskPrediction = {
  communitySlug: string;
  communityName: string;
  sourceTown: string;
  baseline: ProbabilitySummary;
  baselineFeatures: BaselineFeatures;
  weather: {
    available: boolean;
    reason: string | null;
    precipProbability6hMax: number | null;
    rain6hSumMm: number | null;
    rain24hSumMm: number | null;
    weatherRisk: WeatherRiskLevel | null;
    adjustment: number | null;
    adjustmentPercentagePoints: number | null;
    triggeredBy: string[];
  };
  weatherContext: {
    generatedAt: string;
    forecastReferenceTime: string;
  } | null;
  currentRisk: ProbabilitySummary;
  method: CurrentRiskMethod;
};

export type MlPrediction = {
  communitySlug: string;
  communityName: string;
  sourceTown: string;
  floodProbability: number;
  riskPercent: number;
  riskLevel: FloodRiskLevel;
  features: BaselineFeatures;
};

function getErrorMessage(status: number, _detail?: string) {
  if (status === 404) {
    return "The selected community could not be found.";
  }
  if (status === 422) {
    return "The prediction request was invalid. Please choose a supported community and try again.";
  }
  if (status >= 500) {
    return "The flood-risk service is temporarily unavailable.";
  }

  return "Current flood risk could not be loaded right now.";
}

function parseJsonBody(rawBody: string) {
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function getApiUrl() {
  const apiUrl = process.env.ML_API_URL;
  if (!apiUrl) {
    throw new Error("Missing ML_API_URL. Set ML_API_URL=http://127.0.0.1:8000 on the server.");
  }

  return apiUrl.replace(/\/+$/, "");
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, invalidMessage: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(invalidMessage);
  }

  return parsed.data;
}

function mapProbabilitySummary(
  summary: z.infer<typeof ProbabilitySummarySchema>,
): ProbabilitySummary {
  return {
    probability: summary.probability,
    riskPercent: summary.risk_percent,
    riskLevel: summary.risk_level,
  };
}

function mapFeatures(features: z.infer<typeof FeatureSchema>): BaselineFeatures {
  return {
    elevationM: features.elevation_m,
    slopeDeg: features.slope_deg,
    drainageDensity: features.drainage_density,
  };
}

async function fetchMlApi(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Current flood risk took too long to load. Please try again.");
    }

    throw new Error("The flood-risk service is temporarily unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }

  const rawBody = await response.text();
  const parsedBody = parseJsonBody(rawBody);

  if (!response.ok) {
    const detail =
      parsedBody && typeof parsedBody === "object" && "detail" in parsedBody
        ? String(parsedBody.detail)
        : undefined;
    throw new Error(getErrorMessage(response.status, detail));
  }

  if (!parsedBody) {
    throw new Error("Current flood risk could not be loaded right now.");
  }

  return parsedBody;
}

export const getMlCommunities = createServerFn({ method: "GET" }).handler(
  async (): Promise<MlCommunity[]> => {
    const parsedBody = await fetchMlApi("/communities");
    const communities = parseWithSchema(
      CommunityListSchema,
      parsedBody,
      "Communities could not be loaded right now.",
    );

    return communities.map((community) => ({
      slug: community.slug,
      name: community.name,
      weatherAvailable: community.weather_available,
    }));
  },
);

export const predictCurrentFloodRisk = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<CurrentFloodRiskPrediction> => {
    const parsedBody = await fetchMlApi("/predict/current-risk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ community_slug: data.communitySlug }),
    });

    const apiResult = parseWithSchema(
      CurrentRiskApiResponseSchema,
      parsedBody,
      "Current flood risk could not be loaded right now.",
    );

    return {
      communitySlug: apiResult.community_slug,
      communityName: apiResult.community_name,
      sourceTown: apiResult.source_town,
      baseline: mapProbabilitySummary(apiResult.baseline),
      baselineFeatures: mapFeatures(apiResult.baseline_features),
      weather: {
        available: apiResult.weather.available,
        reason: apiResult.weather.reason ?? null,
        precipProbability6hMax: apiResult.weather.precip_probability_6h_max ?? null,
        rain6hSumMm: apiResult.weather.rain_6h_sum_mm ?? null,
        rain24hSumMm: apiResult.weather.rain_24h_sum_mm ?? null,
        weatherRisk: apiResult.weather.weather_risk ?? null,
        adjustment: apiResult.weather.adjustment ?? null,
        adjustmentPercentagePoints: apiResult.weather.adjustment_percentage_points ?? null,
        triggeredBy: apiResult.weather.triggered_by ?? [],
      },
      weatherContext: apiResult.weather_context
        ? {
            generatedAt: apiResult.weather_context.generated_at,
            forecastReferenceTime: apiResult.weather_context.forecast_reference_time,
          }
        : null,
      currentRisk: mapProbabilitySummary(apiResult.current_risk),
      method: apiResult.method,
    };
  });

export const predictCommunityFlood = createServerFn({ method: "POST" })
  .validator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<MlPrediction> => {
    const parsedBody = await fetchMlApi("/predict/community", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ community_slug: data.communitySlug }),
    });

    const apiResult = parseWithSchema(
      CommunityPredictionApiResponseSchema,
      parsedBody,
      "Current flood risk could not be loaded right now.",
    );

    return {
      communitySlug: apiResult.community_slug,
      communityName: apiResult.community_name,
      sourceTown: apiResult.source_town,
      floodProbability: apiResult.flood_probability,
      riskPercent: apiResult.risk_percent,
      riskLevel: apiResult.risk_level,
      features: mapFeatures(apiResult.features),
    };
  });
