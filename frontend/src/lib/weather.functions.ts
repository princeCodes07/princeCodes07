import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CommunityListSchema = z.array(
  z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    weather_available: z.boolean(),
  }),
);

const WeatherResponseSchema = z.object({
  community_slug: z.string().min(1),
  community_name: z.string().min(1),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string().min(1),
  }),
  generated_at: z.string().min(1),
  current: z.object({
    time: z.string().min(1),
    temperature_c: z.number(),
    precipitation_probability_pct: z.number(),
    rain_mm: z.number(),
  }),
  next_6h: z.object({
    precip_probability_max_pct: z.number(),
    rain_sum_mm: z.number(),
  }),
  next_24h: z.object({
    precip_probability_max_pct: z.number(),
    rain_sum_mm: z.number(),
  }),
  model_weather_features: z.object({
    precip_probability_6h_max: z.number(),
    rain_6h_sum_mm: z.number(),
    rain_24h_sum_mm: z.number(),
  }),
  hourly_preview: z.array(
    z.object({
      time: z.string().min(1),
      temperature_c: z.number(),
      precipitation_probability_pct: z.number(),
      rain_mm: z.number(),
    }),
  ),
});

const CommunitySlugSchema = z.object({
  communitySlug: z.string().min(1),
});

export type WeatherCommunity = {
  slug: string;
  name: string;
  weatherAvailable: boolean;
};

export type CommunityWeather = {
  communitySlug: string;
  communityName: string;
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  generatedAt: string;
  current: {
    time: string;
    temperatureC: number;
    precipitationProbabilityPct: number;
    rainMm: number;
  };
  next6h: {
    precipProbabilityMaxPct: number;
    rainSumMm: number;
  };
  next24h: {
    precipProbabilityMaxPct: number;
    rainSumMm: number;
  };
  modelWeatherFeatures: {
    precipProbability6hMax: number;
    rain6hSumMm: number;
    rain24hSumMm: number;
  };
  hourlyPreview: Array<{
    time: string;
    temperatureC: number;
    precipitationProbabilityPct: number;
    rainMm: number;
  }>;
};

function getApiUrl() {
  const apiUrl = process.env.ML_API_URL;
  if (!apiUrl) {
    throw new Error("Missing ML_API_URL. Set ML_API_URL=http://127.0.0.1:8000 on the server.");
  }

  return apiUrl.replace(/\/+$/, "");
}

function parseJsonBody(rawBody: string) {
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function getCommunityListErrorMessage(status: number, _detail?: string) {
  if (status === 404) {
    return "Community weather information is unavailable right now.";
  }
  if (status >= 500) {
    return "Weather information could not be loaded right now.";
  }

  return "Community weather information could not be loaded right now.";
}

function getWeatherErrorMessage(status: number, _detail?: string) {
  if (status === 404) {
    return "The selected community could not be found.";
  }
  if (status === 409) {
    return "Weather information is not yet available for this community.";
  }
  if (status === 502) {
    return "Weather information could not be loaded right now. Please try again shortly.";
  }
  if (status === 504) {
    return "Weather information took too long to load. Please try again.";
  }
  if (status === 422) {
    return "The weather request was invalid. Please choose a supported community and try again.";
  }
  if (status >= 500) {
    return "Weather information could not be loaded right now.";
  }

  return "Weather information could not be loaded right now.";
}

async function fetchMlApi(
  path: string,
  init: RequestInit | undefined,
  getErrorMessage: (status: number, detail?: string) => string,
) {
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
      throw new Error("Weather information took too long to load. Please try again.");
    }

    throw new Error("Weather information could not be loaded right now.");
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
    throw new Error("Weather information could not be loaded right now.");
  }

  return parsedBody;
}

export const getWeatherCommunities = createServerFn({ method: "GET" }).handler(
  async (): Promise<WeatherCommunity[]> => {
    const parsedBody = await fetchMlApi("/communities", undefined, getCommunityListErrorMessage);
    return CommunityListSchema.parse(parsedBody).map((community) => ({
      slug: community.slug,
      name: community.name,
      weatherAvailable: community.weather_available,
    }));
  },
);

export const getCommunityWeather = createServerFn({ method: "POST" })
  .validator((input: unknown) => CommunitySlugSchema.parse(input))
  .handler(async ({ data }): Promise<CommunityWeather> => {
    const parsedBody = await fetchMlApi(
      `/weather/${encodeURIComponent(data.communitySlug)}`,
      undefined,
      getWeatherErrorMessage,
    );

    const weather = WeatherResponseSchema.parse(parsedBody);

    return {
      communitySlug: weather.community_slug,
      communityName: weather.community_name,
      location: weather.location,
      generatedAt: weather.generated_at,
      current: {
        time: weather.current.time,
        temperatureC: weather.current.temperature_c,
        precipitationProbabilityPct: weather.current.precipitation_probability_pct,
        rainMm: weather.current.rain_mm,
      },
      next6h: {
        precipProbabilityMaxPct: weather.next_6h.precip_probability_max_pct,
        rainSumMm: weather.next_6h.rain_sum_mm,
      },
      next24h: {
        precipProbabilityMaxPct: weather.next_24h.precip_probability_max_pct,
        rainSumMm: weather.next_24h.rain_sum_mm,
      },
      modelWeatherFeatures: {
        precipProbability6hMax: weather.model_weather_features.precip_probability_6h_max,
        rain6hSumMm: weather.model_weather_features.rain_6h_sum_mm,
        rain24hSumMm: weather.model_weather_features.rain_24h_sum_mm,
      },
      hourlyPreview: weather.hourly_preview.map((entry) => ({
        time: entry.time,
        temperatureC: entry.temperature_c,
        precipitationProbabilityPct: entry.precipitation_probability_pct,
        rainMm: entry.rain_mm,
      })),
    };
  });
