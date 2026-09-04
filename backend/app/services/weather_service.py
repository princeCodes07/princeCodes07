from __future__ import annotations

import json
import logging
import os
import socket
from bisect import bisect_right
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from threading import Lock
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import urlopen
from zoneinfo import ZoneInfo

from ..schemas.predict import (
    CommunityWeatherResponse,
    HourlyWeatherPreviewPayload,
    ModelWeatherFeaturesPayload,
    WeatherCurrentPayload,
    WeatherLocationPayload,
    WeatherWindowPayload,
)
from .location_service import CommunityLocation

WEATHER_API_FORECAST_URL = "https://api.weatherapi.com/v1/forecast.json"
WEATHER_API_HOSTNAME = urlsplit(WEATHER_API_FORECAST_URL).hostname or "api.weatherapi.com"
WEATHER_API_KEY_ENV_VAR = "WEATHER_API_KEY"
WEATHER_API_FORECAST_DAYS = 2
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_HOSTNAME = urlsplit(OPEN_METEO_FORECAST_URL).hostname or "api.open-meteo.com"
REQUEST_TIMEOUT_SECONDS = 10
CACHE_TTL_SECONDS = 15 * 60
OPEN_METEO_FORECAST_DAYS = 2
OPEN_METEO_HOURLY_VARIABLES = (
    "precipitation_probability",
    "rain",
    "temperature_2m",
)
# Include the current forecast hour plus the full next 24 hours.
PREVIEW_HOURS = 25
logger = logging.getLogger("uvicorn.error")


class WeatherServiceError(RuntimeError):
    """Raised when the upstream weather provider fails unexpectedly."""


class WeatherServiceTimeoutError(WeatherServiceError):
    """Raised when the upstream weather provider exceeds the request timeout."""


class WeatherServiceResponseError(WeatherServiceError):
    """Raised when the upstream weather response is malformed."""


@dataclass(frozen=True)
class HourlyForecastPoint:
    time: datetime
    temperature_c: float
    precipitation_probability_pct: float
    rain_mm: float


@dataclass(frozen=True)
class CachedForecastData:
    expires_at_monotonic: float
    hourly_points: tuple[HourlyForecastPoint, ...]


class WeatherService:
    def __init__(self) -> None:
        self._cache: dict[str, CachedForecastData] = {}
        self._cache_lock = Lock()

    def get_weather(
        self,
        *,
        community_slug: str,
        community_name: str,
        location: CommunityLocation,
    ) -> CommunityWeatherResponse:
        normalized_slug = community_slug.strip().lower()
        hourly_points = self._get_cached_hourly_points(normalized_slug)
        if hourly_points is None:
            hourly_points = self._fetch_provider_hourly_points(
                community_slug=normalized_slug,
                location=location,
            )
            self._store_cached_hourly_points(normalized_slug, hourly_points)

        return self._build_response(
            community_slug=normalized_slug,
            community_name=community_name,
            location=location,
            hourly_points=hourly_points,
        )

    def _fetch_provider_hourly_points(
        self,
        *,
        community_slug: str,
        location: CommunityLocation,
    ) -> tuple[HourlyForecastPoint, ...]:
        weather_api_error: WeatherServiceError | None = None

        try:
            return self._fetch_weatherapi_hourly_points(
                location,
                community_slug=community_slug,
            )
        except WeatherServiceError as error:
            weather_api_error = error

        try:
            return self._fetch_openmeteo_hourly_points(
                location,
                community_slug=community_slug,
            )
        except WeatherServiceError as error:
            raise error from weather_api_error

    def _get_cached_hourly_points(
        self, community_slug: str
    ) -> tuple[HourlyForecastPoint, ...] | None:
        now = monotonic()
        with self._cache_lock:
            cached = self._cache.get(community_slug)
            if cached is None:
                return None
            if cached.expires_at_monotonic <= now:
                self._cache.pop(community_slug, None)
                return None
            return tuple(deepcopy(cached.hourly_points))

    def _store_cached_hourly_points(
        self,
        community_slug: str,
        hourly_points: tuple[HourlyForecastPoint, ...],
    ) -> None:
        with self._cache_lock:
            self._cache[community_slug] = CachedForecastData(
                expires_at_monotonic=monotonic() + CACHE_TTL_SECONDS,
                hourly_points=tuple(deepcopy(hourly_points)),
            )

    def _fetch_weatherapi_hourly_points(
        self,
        location: CommunityLocation,
        *,
        community_slug: str | None = None,
    ) -> tuple[HourlyForecastPoint, ...]:
        forecast_json = self._fetch_weatherapi_forecast_json(
            location,
            community_slug=community_slug,
        )
        try:
            return tuple(self._parse_weatherapi_hourly_points(forecast_json, location.timezone))
        except WeatherServiceResponseError as error:
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="response parsing",
            )
            raise

    def _fetch_openmeteo_hourly_points(
        self,
        location: CommunityLocation,
        *,
        community_slug: str | None = None,
    ) -> tuple[HourlyForecastPoint, ...]:
        forecast_json = self._fetch_openmeteo_forecast_json(
            location,
            community_slug=community_slug,
        )
        try:
            return tuple(self._parse_openmeteo_hourly_points(forecast_json, location.timezone))
        except WeatherServiceResponseError as error:
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="response parsing",
                fallback=True,
            )
            raise

    def _fetch_weatherapi_forecast_json(
        self,
        location: CommunityLocation,
        *,
        community_slug: str | None = None,
    ) -> dict[str, object]:
        api_key = os.getenv(WEATHER_API_KEY_ENV_VAR, "").strip()
        if not api_key:
            error = WeatherServiceError("WeatherAPI key is not configured.")
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
            )
            raise error

        query = urlencode(
            {
                "key": api_key,
                "q": f"{location.latitude:.6f},{location.longitude:.6f}",
                "days": str(WEATHER_API_FORECAST_DAYS),
                "aqi": "no",
                "alerts": "no",
            }
        )
        url = f"{WEATHER_API_FORECAST_URL}?{query}"

        try:
            with urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                if getattr(response, "status", 200) != 200:
                    error = WeatherServiceError(
                        f"WeatherAPI forecast request failed with status {response.status}."
                    )
                    self._log_provider_failure(
                        provider_name="WeatherAPI",
                        hostname=WEATHER_API_HOSTNAME,
                        community_slug=community_slug,
                        error=error,
                        phase="request",
                    )
                    raise error
                body = response.read()
        except HTTPError as error:
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
            )
            raise WeatherServiceError(
                f"WeatherAPI forecast request failed with status {error.code}."
            ) from error
        except socket.timeout as error:
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
            )
            raise WeatherServiceTimeoutError("WeatherAPI forecast request timed out.") from error
        except TimeoutError as error:
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
            )
            raise WeatherServiceTimeoutError("WeatherAPI forecast request timed out.") from error
        except URLError as error:
            if isinstance(error.reason, (TimeoutError, socket.timeout)):
                self._log_provider_failure(
                    provider_name="WeatherAPI",
                    hostname=WEATHER_API_HOSTNAME,
                    community_slug=community_slug,
                    error=error,
                    phase="request",
                )
                raise WeatherServiceTimeoutError("WeatherAPI forecast request timed out.") from error
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
            )
            raise WeatherServiceError("WeatherAPI forecast request failed.") from error

        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception as error:
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="response decoding",
            )
            raise WeatherServiceResponseError(
                "WeatherAPI returned unreadable forecast JSON."
            ) from error

        if not isinstance(payload, dict):
            error = WeatherServiceResponseError("WeatherAPI returned an unexpected payload shape.")
            self._log_provider_failure(
                provider_name="WeatherAPI",
                hostname=WEATHER_API_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="response decoding",
            )
            raise error

        return payload

    def _fetch_openmeteo_forecast_json(
        self,
        location: CommunityLocation,
        *,
        community_slug: str | None = None,
    ) -> dict[str, object]:
        query = urlencode(
            {
                "latitude": f"{location.latitude:.6f}",
                "longitude": f"{location.longitude:.6f}",
                "hourly": ",".join(OPEN_METEO_HOURLY_VARIABLES),
                "forecast_days": str(OPEN_METEO_FORECAST_DAYS),
                "timezone": location.timezone,
            }
        )
        url = f"{OPEN_METEO_FORECAST_URL}?{query}"

        try:
            with urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                if getattr(response, "status", 200) != 200:
                    error = WeatherServiceError(
                        f"Open-Meteo forecast request failed with status {response.status}."
                    )
                    self._log_provider_failure(
                        provider_name="Open-Meteo",
                        hostname=OPEN_METEO_HOSTNAME,
                        community_slug=community_slug,
                        error=error,
                        phase="request",
                        fallback=True,
                    )
                    raise error
                body = response.read()
        except HTTPError as error:
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
                fallback=True,
            )
            raise WeatherServiceError(
                f"Open-Meteo forecast request failed with status {error.code}."
            ) from error
        except socket.timeout as error:
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
                fallback=True,
            )
            raise WeatherServiceTimeoutError("Open-Meteo forecast request timed out.") from error
        except TimeoutError as error:
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
                fallback=True,
            )
            raise WeatherServiceTimeoutError("Open-Meteo forecast request timed out.") from error
        except URLError as error:
            if isinstance(error.reason, (TimeoutError, socket.timeout)):
                self._log_provider_failure(
                    provider_name="Open-Meteo",
                    hostname=OPEN_METEO_HOSTNAME,
                    community_slug=community_slug,
                    error=error,
                    phase="request",
                    fallback=True,
                )
                raise WeatherServiceTimeoutError(
                    "Open-Meteo forecast request timed out."
                ) from error
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="request",
                fallback=True,
            )
            raise WeatherServiceError("Open-Meteo forecast request failed.") from error

        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception as error:
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="response decoding",
                fallback=True,
            )
            raise WeatherServiceResponseError(
                "Open-Meteo returned unreadable forecast JSON."
            ) from error

        if not isinstance(payload, dict):
            error = WeatherServiceResponseError("Open-Meteo returned an unexpected payload shape.")
            self._log_provider_failure(
                provider_name="Open-Meteo",
                hostname=OPEN_METEO_HOSTNAME,
                community_slug=community_slug,
                error=error,
                phase="response decoding",
                fallback=True,
            )
            raise error

        return payload

    def _log_provider_failure(
        self,
        *,
        provider_name: str,
        hostname: str,
        community_slug: str | None,
        error: BaseException,
        phase: str,
        fallback: bool = False,
    ) -> None:
        slug_suffix = f" for {community_slug}" if community_slug else ""
        operation = "fallback request" if fallback and phase == "request" else (
            "forecast request" if phase == "request" else phase
        )
        logger.warning(
            "%s %s failed%s via %s: %s: %s",
            provider_name,
            operation,
            slug_suffix,
            hostname,
            error.__class__.__name__,
            error,
        )

    def _build_response(
        self,
        *,
        community_slug: str,
        community_name: str,
        location: CommunityLocation,
        hourly_points: tuple[HourlyForecastPoint, ...],
    ) -> CommunityWeatherResponse:
        current_index = self._resolve_current_index(hourly_points, location.timezone)
        current_point = hourly_points[current_index]

        next_6h_points = self._slice_future_window(
            hourly_points,
            current_index,
            6,
            provider_name="Weather provider",
        )
        next_24h_points = self._slice_future_window(
            hourly_points,
            current_index,
            24,
            provider_name="Weather provider",
        )
        hourly_preview_points = hourly_points[current_index : current_index + PREVIEW_HOURS]

        next_6h = self._aggregate_window(next_6h_points)
        next_24h = self._aggregate_window(next_24h_points)

        generated_at = datetime.now(ZoneInfo(location.timezone)).isoformat()

        return CommunityWeatherResponse(
            community_slug=community_slug,
            community_name=community_name,
            location=WeatherLocationPayload(
                latitude=round(location.latitude, 6),
                longitude=round(location.longitude, 6),
                timezone=location.timezone,
            ),
            generated_at=generated_at,
            current=WeatherCurrentPayload(
                time=self._format_local_time(current_point.time, location.timezone),
                temperature_c=round(current_point.temperature_c, 2),
                precipitation_probability_pct=round(
                    current_point.precipitation_probability_pct, 2
                ),
                rain_mm=round(current_point.rain_mm, 2),
            ),
            next_6h=WeatherWindowPayload(
                precip_probability_max_pct=round(next_6h["precip_probability_max_pct"], 2),
                rain_sum_mm=round(next_6h["rain_sum_mm"], 2),
            ),
            next_24h=WeatherWindowPayload(
                precip_probability_max_pct=round(next_24h["precip_probability_max_pct"], 2),
                rain_sum_mm=round(next_24h["rain_sum_mm"], 2),
            ),
            model_weather_features=ModelWeatherFeaturesPayload(
                precip_probability_6h_max=round(next_6h["precip_probability_max_pct"], 2),
                rain_6h_sum_mm=round(next_6h["rain_sum_mm"], 2),
                rain_24h_sum_mm=round(next_24h["rain_sum_mm"], 2),
            ),
            hourly_preview=[
                HourlyWeatherPreviewPayload(
                    time=self._format_local_time(point.time, location.timezone),
                    temperature_c=round(point.temperature_c, 2),
                    precipitation_probability_pct=round(
                        point.precipitation_probability_pct, 2
                    ),
                    rain_mm=round(point.rain_mm, 2),
                )
                for point in hourly_preview_points
            ],
        )

    def _parse_weatherapi_hourly_points(
        self,
        forecast_json: dict[str, object],
        timezone_name: str,
    ) -> list[HourlyForecastPoint]:
        forecast = forecast_json.get("forecast")
        if not isinstance(forecast, dict):
            raise WeatherServiceResponseError("WeatherAPI forecast block is missing.")

        forecast_days = forecast.get("forecastday")
        if not isinstance(forecast_days, list) or not forecast_days:
            raise WeatherServiceResponseError("WeatherAPI forecast days are missing.")

        points: list[HourlyForecastPoint] = []
        for day in forecast_days:
            if not isinstance(day, dict):
                raise WeatherServiceResponseError("WeatherAPI forecast day entry is invalid.")

            day_hours = day.get("hour")
            if not isinstance(day_hours, list):
                raise WeatherServiceResponseError("WeatherAPI hourly forecast block is missing.")

            for hour_entry in day_hours:
                if not isinstance(hour_entry, dict):
                    raise WeatherServiceResponseError("WeatherAPI hourly entry is invalid.")

                try:
                    raw_time = hour_entry.get("time")
                    if raw_time is None:
                        raise ValueError("Missing time value.")

                    time_value = datetime.fromisoformat(str(raw_time).replace(" ", "T"))
                    temperature_c = self._coerce_float(
                        hour_entry.get("temp_c"),
                        "temp_c",
                        provider_name="WeatherAPI",
                    )
                    precipitation_probability_pct = self._coerce_float(
                        hour_entry.get("chance_of_rain"),
                        "chance_of_rain",
                        provider_name="WeatherAPI",
                    )
                    rain_mm = self._coerce_float(
                        hour_entry.get("precip_mm"),
                        "precip_mm",
                        provider_name="WeatherAPI",
                    )
                except Exception as error:
                    raise WeatherServiceResponseError(
                        "WeatherAPI hourly forecast contains invalid values."
                    ) from error

                points.append(
                    HourlyForecastPoint(
                        time=time_value,
                        temperature_c=temperature_c,
                        precipitation_probability_pct=precipitation_probability_pct,
                        rain_mm=rain_mm,
                    )
                )

        points.sort(key=lambda point: point.time)
        self._validate_hourly_points(points, timezone_name, provider_name="WeatherAPI")
        return points

    def _parse_openmeteo_hourly_points(
        self,
        forecast_json: dict[str, object],
        timezone_name: str,
    ) -> list[HourlyForecastPoint]:
        hourly = forecast_json.get("hourly")
        if not isinstance(hourly, dict):
            raise WeatherServiceResponseError("Open-Meteo hourly forecast block is missing.")

        time_values = hourly.get("time")
        temperature_values = hourly.get("temperature_2m")
        precipitation_probability_values = hourly.get("precipitation_probability")
        rain_values = hourly.get("rain")

        if not all(
            isinstance(values, list)
            for values in (
                time_values,
                temperature_values,
                precipitation_probability_values,
                rain_values,
            )
        ):
            raise WeatherServiceResponseError(
                "Open-Meteo hourly forecast arrays are missing expected variables."
            )

        lengths = {
            len(time_values),
            len(temperature_values),
            len(precipitation_probability_values),
            len(rain_values),
        }
        if len(lengths) != 1 or not lengths:
            raise WeatherServiceResponseError(
                "Open-Meteo hourly forecast arrays have inconsistent lengths."
            )

        points: list[HourlyForecastPoint] = []
        for index, raw_time in enumerate(time_values):
            try:
                if raw_time is None:
                    raise ValueError("Missing time value.")

                time_value = datetime.fromisoformat(str(raw_time))
                temperature_c = self._coerce_float(
                    temperature_values[index],
                    "temperature_2m",
                    provider_name="Open-Meteo",
                )
                precipitation_probability_pct = self._coerce_float(
                    precipitation_probability_values[index],
                    "precipitation_probability",
                    provider_name="Open-Meteo",
                )
                rain_mm = self._coerce_float(
                    rain_values[index],
                    "rain",
                    provider_name="Open-Meteo",
                )
            except Exception as error:
                raise WeatherServiceResponseError(
                    "Open-Meteo hourly forecast contains invalid values."
                ) from error

            points.append(
                HourlyForecastPoint(
                    time=time_value,
                    temperature_c=temperature_c,
                    precipitation_probability_pct=precipitation_probability_pct,
                    rain_mm=rain_mm,
                )
            )

        self._validate_hourly_points(points, timezone_name, provider_name="Open-Meteo")
        return points

    def _validate_hourly_points(
        self,
        points: list[HourlyForecastPoint],
        timezone_name: str,
        *,
        provider_name: str,
    ) -> None:
        if len(points) < 25:
            raise WeatherServiceResponseError(
                f"{provider_name} did not return enough hourly data for 24-hour aggregation."
            )

        try:
            ZoneInfo(timezone_name)
        except Exception as error:
            raise WeatherServiceResponseError(
                f"Invalid timezone '{timezone_name}' supplied for weather parsing."
            ) from error

    def _resolve_current_index(
        self,
        hourly_points: list[HourlyForecastPoint],
        timezone_name: str,
    ) -> int:
        now_local = (
            datetime.now(ZoneInfo(timezone_name))
            .replace(minute=0, second=0, microsecond=0)
            .replace(tzinfo=None)
        )
        times = [point.time for point in hourly_points]
        insertion_index = bisect_right(times, now_local) - 1

        if insertion_index < 0:
            return 0
        if insertion_index >= len(hourly_points):
            return len(hourly_points) - 1
        return insertion_index

    def _slice_future_window(
        self,
        hourly_points: list[HourlyForecastPoint],
        current_index: int,
        hours: int,
        *,
        provider_name: str,
    ) -> list[HourlyForecastPoint]:
        start_index = current_index + 1
        end_index = start_index + hours
        window = hourly_points[start_index:end_index]
        if len(window) != hours:
            raise WeatherServiceResponseError(
                f"{provider_name} forecast is missing the next {hours} hourly entries."
            )
        return window

    def _aggregate_window(self, window: list[HourlyForecastPoint]) -> dict[str, float]:
        if not window:
            raise WeatherServiceResponseError("Cannot aggregate an empty weather window.")

        return {
            "precip_probability_max_pct": max(
                point.precipitation_probability_pct for point in window
            ),
            "rain_sum_mm": sum(point.rain_mm for point in window),
        }

    def _coerce_float(self, value: object, field_name: str, *, provider_name: str) -> float:
        if value is None:
            raise WeatherServiceResponseError(
                f"{provider_name} hourly variable '{field_name}' contains a missing value."
            )
        return float(value)

    def _format_local_time(self, value: datetime, timezone_name: str) -> str:
        return value.replace(tzinfo=ZoneInfo(timezone_name)).isoformat()


weather_service = WeatherService()
