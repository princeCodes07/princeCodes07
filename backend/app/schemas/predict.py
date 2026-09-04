from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class PredictRequest(BaseModel):
    elevation_m: float
    slope_deg: float
    drainage_density: float


class FeaturePayload(BaseModel):
    elevation_m: float
    slope_deg: float
    drainage_density: float


class PredictResponse(BaseModel):
    flood_probability: float
    risk_percent: int
    risk_level: str
    features: FeaturePayload


class CommunityPredictRequest(BaseModel):
    community_slug: str


class CommunitySummary(BaseModel):
    slug: str
    name: str
    weather_available: bool = False


class CommunityPredictResponse(PredictResponse):
    community_slug: str
    community_name: str
    source_town: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    community_data_loaded: bool
    location_data_loaded: bool
    features: list[str]


class WeatherLocationPayload(BaseModel):
    latitude: float
    longitude: float
    timezone: str


class WeatherCurrentPayload(BaseModel):
    time: str
    temperature_c: float
    precipitation_probability_pct: float
    rain_mm: float


class WeatherWindowPayload(BaseModel):
    precip_probability_max_pct: float
    rain_sum_mm: float


class ModelWeatherFeaturesPayload(BaseModel):
    precip_probability_6h_max: float
    rain_6h_sum_mm: float
    rain_24h_sum_mm: float


class HourlyWeatherPreviewPayload(BaseModel):
    time: str
    temperature_c: float
    precipitation_probability_pct: float
    rain_mm: float


class CommunityWeatherResponse(BaseModel):
    community_slug: str
    community_name: str
    location: WeatherLocationPayload
    generated_at: str
    current: WeatherCurrentPayload
    next_6h: WeatherWindowPayload
    next_24h: WeatherWindowPayload
    model_weather_features: ModelWeatherFeaturesPayload
    hourly_preview: list[HourlyWeatherPreviewPayload]


class CurrentRiskPredictRequest(BaseModel):
    community_slug: str


class ProbabilitySummary(BaseModel):
    probability: float
    risk_percent: int
    risk_level: str


class WeatherAdjustmentPayload(BaseModel):
    available: bool
    reason: str | None = None
    precip_probability_6h_max: float | None = None
    rain_6h_sum_mm: float | None = None
    rain_24h_sum_mm: float | None = None
    weather_risk: str | None = None
    adjustment: float | None = None
    adjustment_percentage_points: int | None = None
    triggered_by: list[str] | None = None


class WeatherContextPayload(BaseModel):
    generated_at: str
    forecast_reference_time: str


class CurrentRiskPredictResponse(BaseModel):
    community_slug: str
    community_name: str
    source_town: str
    baseline: ProbabilitySummary
    baseline_features: FeaturePayload
    weather: WeatherAdjustmentPayload
    weather_context: WeatherContextPayload | None = None
    current_risk: ProbabilitySummary
    method: Literal["hybrid_rule_adjusted", "baseline_only", "baseline_only_weather_unavailable"]
