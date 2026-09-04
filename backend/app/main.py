from __future__ import annotations

import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas.predict import (
    CommunityPredictRequest,
    CommunityPredictResponse,
    CurrentRiskPredictRequest,
    CurrentRiskPredictResponse,
    CommunitySummary,
    CommunityWeatherResponse,
    HealthResponse,
    PredictRequest,
    PredictResponse,
    ProbabilitySummary,
    WeatherAdjustmentPayload,
    WeatherContextPayload,
)
from .services.community_service import (
    CommunityConfigurationError,
    UnknownCommunitySlugError,
    community_service,
)
from .services.location_service import (
    CommunityLocationConfigurationError,
    UnknownCommunityLocationError,
    location_service,
)
from .services.model_service import model_service
from .services.weather_service import (
    WeatherServiceError,
    WeatherServiceResponseError,
    WeatherServiceTimeoutError,
    weather_service,
)
from .services.weather_risk_service import weather_risk_service

logger = logging.getLogger(__name__)


def get_allowed_origins() -> list[str]:
    default_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    configured = os.getenv("BACKEND_CORS_ORIGINS", "")
    extra_origins = [origin.strip() for origin in configured.split(",") if origin.strip()]

    merged: list[str] = []
    for origin in default_origins + extra_origins:
        if origin not in merged:
            merged.append(origin)
    return merged


app = FastAPI(
    title="AccraFloodWatch Model API",
    version="1.0.0",
    description="FastAPI wrapper around the existing flood_model.pkl inference flow.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
def validate_runtime_readiness() -> None:
    if not model_service.is_loaded:
        logger.critical("Backend startup failed because the model did not load.")
        raise RuntimeError("Backend startup failed because the model did not load.")

    if not community_service.is_loaded:
        logger.critical("Backend startup failed because community data did not load.")
        raise RuntimeError("Backend startup failed because community data did not load.")

    if location_service.load_error is not None:
        logger.warning(
            "Community location data is unavailable; weather endpoints and hybrid weather checks "
            "will fall back until the dataset is fixed."
        )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=model_service.is_loaded,
        community_data_loaded=community_service.is_loaded,
        location_data_loaded=location_service.is_loaded,
        features=model_service.features,
    )


@app.get("/communities", response_model=list[CommunitySummary])
def list_communities() -> list[CommunitySummary]:
    try:
        communities = community_service.list_communities()
        return [
            CommunitySummary(
                slug=community.slug,
                name=community.name,
                weather_available=location_service.has_location(community.slug),
            )
            for community in communities
        ]
    except CommunityConfigurationError as error:
        raise HTTPException(status_code=500, detail="Community listing failed.") from error


@app.get("/weather/{community_slug}", response_model=CommunityWeatherResponse)
def get_community_weather(community_slug: str) -> CommunityWeatherResponse:
    try:
        normalized_slug, community_row = community_service.resolve_slug(community_slug)
        location = location_service.get_location(normalized_slug)
        return weather_service.get_weather(
            community_slug=normalized_slug,
            community_name=community_row.town,
            location=location,
        )
    except UnknownCommunitySlugError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnknownCommunityLocationError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except CommunityLocationConfigurationError as error:
        raise HTTPException(status_code=500, detail="Community weather lookup failed.") from error
    except WeatherServiceTimeoutError as error:
        raise HTTPException(status_code=504, detail="Upstream weather request timed out.") from error
    except WeatherServiceResponseError as error:
        raise HTTPException(
            status_code=502,
            detail="Upstream weather response was malformed.",
        ) from error
    except WeatherServiceError as error:
        raise HTTPException(status_code=502, detail="Upstream weather request failed.") from error


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    try:
        return model_service.predict(payload)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail="Prediction failed.") from error


@app.post("/predict/community", response_model=CommunityPredictResponse)
def predict_community(payload: CommunityPredictRequest) -> CommunityPredictResponse:
    try:
        normalized_slug, community_row = community_service.resolve_slug(payload.community_slug)
        prediction = model_service.predict_features(community_row.features)
        return CommunityPredictResponse(
            community_slug=normalized_slug,
            community_name=community_row.town,
            source_town=community_row.town,
            flood_probability=prediction.flood_probability,
            risk_percent=prediction.risk_percent,
            risk_level=prediction.risk_level,
            features=prediction.features,
        )
    except UnknownCommunitySlugError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CommunityConfigurationError as error:
        raise HTTPException(status_code=500, detail="Community lookup failed.") from error
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail="Prediction failed.") from error


@app.post("/predict/current-risk", response_model=CurrentRiskPredictResponse)
def predict_current_risk(payload: CurrentRiskPredictRequest) -> CurrentRiskPredictResponse:
    try:
        normalized_slug, community_row = community_service.resolve_slug(payload.community_slug)
        baseline_prediction = model_service.predict_features(community_row.features)
    except UnknownCommunitySlugError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except CommunityConfigurationError as error:
        raise HTTPException(status_code=500, detail="Community lookup failed.") from error
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail="Prediction failed.") from error

    baseline = ProbabilitySummary(
        probability=baseline_prediction.flood_probability,
        risk_percent=baseline_prediction.risk_percent,
        risk_level=baseline_prediction.risk_level,
    )

    try:
        location = location_service.get_location(normalized_slug)
        weather = weather_service.get_weather(
            community_slug=normalized_slug,
            community_name=community_row.town,
            location=location,
        )
        weather_assessment = weather_risk_service.assess_weather_response(weather)
        adjusted = weather_risk_service.apply_adjustment(
            baseline_probability=baseline_prediction.flood_probability,
            weather_adjustment=weather_assessment.adjustment,
        )

        return CurrentRiskPredictResponse(
            community_slug=normalized_slug,
            community_name=community_row.town,
            source_town=community_row.town,
            baseline=baseline,
            baseline_features=baseline_prediction.features,
            weather=WeatherAdjustmentPayload(
                available=True,
                precip_probability_6h_max=weather_assessment.precip_probability_6h_max,
                rain_6h_sum_mm=weather_assessment.rain_6h_sum_mm,
                rain_24h_sum_mm=weather_assessment.rain_24h_sum_mm,
                weather_risk=weather_assessment.weather_risk,
                adjustment=weather_assessment.adjustment,
                adjustment_percentage_points=weather_assessment.adjustment_percentage_points,
                triggered_by=weather_assessment.triggered_by,
            ),
            weather_context=WeatherContextPayload(
                generated_at=weather.generated_at,
                forecast_reference_time=weather.current.time,
            ),
            current_risk=ProbabilitySummary(
                probability=adjusted.probability,
                risk_percent=adjusted.risk_percent,
                risk_level=adjusted.risk_level,
            ),
            method="hybrid_rule_adjusted",
        )
    except UnknownCommunityLocationError:
        return CurrentRiskPredictResponse(
            community_slug=normalized_slug,
            community_name=community_row.town,
            source_town=community_row.town,
            baseline=baseline,
            baseline_features=baseline_prediction.features,
            weather=WeatherAdjustmentPayload(
                available=False,
                reason="Weather information is not yet available for this community.",
            ),
            current_risk=baseline,
            method="baseline_only",
        )
    except (
        CommunityLocationConfigurationError,
        WeatherServiceTimeoutError,
        WeatherServiceResponseError,
        WeatherServiceError,
    ):
        return CurrentRiskPredictResponse(
            community_slug=normalized_slug,
            community_name=community_row.town,
            source_town=community_row.town,
            baseline=baseline,
            baseline_features=baseline_prediction.features,
            weather=WeatherAdjustmentPayload(
                available=False,
                reason="Live weather adjustment is temporarily unavailable.",
            ),
            current_risk=baseline,
            method="baseline_only_weather_unavailable",
        )
