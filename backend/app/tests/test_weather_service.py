from __future__ import annotations

import json
import socket
from datetime import datetime
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from fastapi import HTTPException

from app.main import get_community_weather, predict_current_risk
from app.schemas.predict import CurrentRiskPredictRequest, FeaturePayload
from app.services.location_service import CommunityLocation, UnknownCommunityLocationError
from app.services.weather_service import (
    OPEN_METEO_FORECAST_URL,
    WEATHER_API_FORECAST_URL,
    WEATHER_API_KEY_ENV_VAR,
    WeatherService,
    WeatherServiceError,
    WeatherServiceTimeoutError,
)


def build_openmeteo_hourly_payload() -> dict[str, object]:
    times: list[str] = []
    temperatures: list[float] = []
    precipitation_probabilities: list[float] = []
    rain_amounts: list[float] = []

    for hour in range(48):
        day = "2026-08-21" if hour < 24 else "2026-08-22"
        day_hour = hour if hour < 24 else hour - 24
        times.append(f"{day}T{day_hour:02d}:00")
        temperatures.append(24.0 + (hour * 0.5))
        precipitation_probabilities.append(float(hour))
        rain_amounts.append(round(hour / 10, 1))

    return {
        "hourly": {
            "time": times,
            "temperature_2m": temperatures,
            "precipitation_probability": precipitation_probabilities,
            "rain": rain_amounts,
        }
    }


def build_weatherapi_forecast_payload() -> dict[str, object]:
    forecast_days: list[dict[str, object]] = []

    for day_index, day in enumerate(("2026-08-21", "2026-08-22")):
        hours: list[dict[str, object]] = []
        for hour in range(24):
            absolute_hour = day_index * 24 + hour
            hours.append(
                {
                    "time": f"{day} {hour:02d}:00",
                    "temp_c": 24.0 + (absolute_hour * 0.5),
                    "chance_of_rain": float(absolute_hour),
                    "precip_mm": round(absolute_hour / 10, 1),
                }
            )

        forecast_days.append({"date": day, "hour": hours})

    return {"forecast": {"forecastday": forecast_days}}


def make_success_response(payload: dict[str, object]) -> MagicMock:
    response = MagicMock()
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    response.status = 200
    response.read.return_value = json.dumps(payload).encode("utf-8")
    return response


class FixedDateTime(datetime):
    current_time = datetime(2026, 8, 21, 13, 55)

    @classmethod
    def now(cls, tz=None):
        current = cls.current_time
        if tz is not None:
            return current.replace(tzinfo=tz)
        return current


class WeatherServiceCacheTests(TestCase):
    def setUp(self) -> None:
        FixedDateTime.current_time = datetime(2026, 8, 21, 13, 55)
        self.location = CommunityLocation(
            community_slug="kaneshie",
            town="Kaneshie",
            latitude=5.57169,
            longitude=-0.23761,
            timezone="Africa/Accra",
            geocoding_source="test",
            review_status="approved",
        )
        self.service = WeatherService()
        self.weatherapi_payload = build_weatherapi_forecast_payload()

    def test_cache_reuses_provider_data_within_same_hour(self) -> None:
        fetch_count = 0

        def fake_fetch(
            _location: CommunityLocation, *, community_slug: str | None = None
        ) -> dict[str, object]:
            nonlocal fetch_count
            fetch_count += 1
            return self.weatherapi_payload

        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: "test-key"}, clear=False),
            patch("app.services.weather_service.datetime", FixedDateTime),
            patch.object(self.service, "_fetch_weatherapi_forecast_json", side_effect=fake_fetch),
        ):
            first = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )
            second = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )

        self.assertEqual(fetch_count, 1)
        self.assertEqual(first.current.time, "2026-08-21T13:00:00+00:00")
        self.assertEqual(second.current.time, "2026-08-21T13:00:00+00:00")
        self.assertEqual(first.next_6h.precip_probability_max_pct, 19.0)
        self.assertEqual(second.next_6h.precip_probability_max_pct, 19.0)

    def test_cache_rebuilds_hour_windows_after_hour_boundary(self) -> None:
        fetch_count = 0

        def fake_fetch(
            _location: CommunityLocation, *, community_slug: str | None = None
        ) -> dict[str, object]:
            nonlocal fetch_count
            fetch_count += 1
            return self.weatherapi_payload

        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: "test-key"}, clear=False),
            patch("app.services.weather_service.datetime", FixedDateTime),
            patch.object(self.service, "_fetch_weatherapi_forecast_json", side_effect=fake_fetch),
        ):
            FixedDateTime.current_time = datetime(2026, 8, 21, 13, 55)
            first = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )

            FixedDateTime.current_time = datetime(2026, 8, 21, 14, 5)
            second = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )

        self.assertEqual(fetch_count, 1)
        self.assertEqual(first.current.time, "2026-08-21T13:00:00+00:00")
        self.assertEqual(second.current.time, "2026-08-21T14:00:00+00:00")
        self.assertEqual(first.next_6h.precip_probability_max_pct, 19.0)
        self.assertEqual(second.next_6h.precip_probability_max_pct, 20.0)
        self.assertEqual(first.next_6h.rain_sum_mm, 9.9)
        self.assertEqual(second.next_6h.rain_sum_mm, 10.5)

    def test_weatherapi_response_mapping_uses_expected_windows(self) -> None:
        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: "test-key"}, clear=False),
            patch("app.services.weather_service.datetime", FixedDateTime),
            patch.object(self.service, "_fetch_weatherapi_forecast_json", return_value=self.weatherapi_payload),
        ):
            response = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )

        self.assertEqual(response.current.temperature_c, 30.5)
        self.assertEqual(response.current.precipitation_probability_pct, 13.0)
        self.assertEqual(response.current.rain_mm, 1.3)
        self.assertEqual(response.next_6h.precip_probability_max_pct, 19.0)
        self.assertEqual(response.next_24h.precip_probability_max_pct, 37.0)
        self.assertEqual(response.next_6h.rain_sum_mm, 9.9)
        self.assertEqual(response.next_24h.rain_sum_mm, 61.2)
        self.assertEqual(response.model_weather_features.precip_probability_6h_max, 19.0)
        self.assertEqual(response.model_weather_features.rain_6h_sum_mm, 9.9)
        self.assertEqual(response.model_weather_features.rain_24h_sum_mm, 61.2)
        self.assertEqual(response.hourly_preview[0].time, "2026-08-21T13:00:00+00:00")
        self.assertEqual(response.hourly_preview[1].precipitation_probability_pct, 14.0)


class WeatherServiceProviderTests(TestCase):
    def setUp(self) -> None:
        self.location = CommunityLocation(
            community_slug="kaneshie",
            town="Kaneshie",
            latitude=5.57169,
            longitude=-0.23761,
            timezone="Africa/Accra",
            geocoding_source="test",
            review_status="approved",
        )
        self.service = WeatherService()
        self.openmeteo_payload = build_openmeteo_hourly_payload()
        self.weatherapi_payload = build_weatherapi_forecast_payload()

    def test_fetch_weatherapi_forecast_json_returns_payload_on_success(self) -> None:
        response = make_success_response(self.weatherapi_payload)

        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: "test-key"}, clear=False),
            patch("app.services.weather_service.urlopen", return_value=response),
        ):
            payload = self.service._fetch_weatherapi_forecast_json(
                self.location,
                community_slug="kaneshie",
            )

        self.assertEqual(
            payload["forecast"]["forecastday"][0]["hour"][0]["time"],
            "2026-08-21 00:00",
        )

    def test_weatherapi_missing_key_falls_back_to_openmeteo(self) -> None:
        with (
            patch.dict("os.environ", {}, clear=True),
            patch("app.services.weather_service.datetime", FixedDateTime),
            patch.object(self.service, "_fetch_openmeteo_forecast_json", return_value=self.openmeteo_payload),
            self.assertLogs("uvicorn.error", level="WARNING") as logs,
        ):
            response = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )

        self.assertEqual(response.current.time, "2026-08-21T13:00:00+00:00")
        self.assertEqual(response.next_6h.precip_probability_max_pct, 19.0)
        self.assertIn(
            "WeatherAPI forecast request failed for kaneshie via api.weatherapi.com: WeatherServiceError:",
            logs.output[0],
        )

    def test_weatherapi_failure_falls_back_to_openmeteo(self) -> None:
        weatherapi_error = HTTPError(
            url=WEATHER_API_FORECAST_URL,
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=None,
        )
        openmeteo_response = make_success_response(self.openmeteo_payload)

        def fake_urlopen(url: str, timeout: int):
            if url.startswith(WEATHER_API_FORECAST_URL):
                raise weatherapi_error
            if url.startswith(OPEN_METEO_FORECAST_URL):
                return openmeteo_response
            raise AssertionError(f"Unexpected URL: {url}")

        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: "test-key"}, clear=False),
            patch("app.services.weather_service.datetime", FixedDateTime),
            patch("app.services.weather_service.urlopen", side_effect=fake_urlopen),
            self.assertLogs("uvicorn.error", level="WARNING") as logs,
        ):
            response = self.service.get_weather(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
            )

        self.assertEqual(response.current.time, "2026-08-21T13:00:00+00:00")
        self.assertEqual(response.current.temperature_c, 30.5)
        self.assertEqual(response.model_weather_features.rain_24h_sum_mm, 61.2)
        self.assertEqual(len(logs.output), 1)
        self.assertIn(
            "WeatherAPI forecast request failed for kaneshie via api.weatherapi.com: HTTPError:",
            logs.output[0],
        )

    def test_both_providers_fail_and_logs_do_not_include_api_key(self) -> None:
        secret_key = "secret-weather-key"
        weatherapi_error = HTTPError(
            url=WEATHER_API_FORECAST_URL,
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=None,
        )
        openmeteo_error = HTTPError(
            url=OPEN_METEO_FORECAST_URL,
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=None,
        )

        def fake_urlopen(url: str, timeout: int):
            if url.startswith(WEATHER_API_FORECAST_URL):
                raise weatherapi_error
            if url.startswith(OPEN_METEO_FORECAST_URL):
                raise openmeteo_error
            raise AssertionError(f"Unexpected URL: {url}")

        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: secret_key}, clear=False),
            patch("app.services.weather_service.urlopen", side_effect=fake_urlopen),
            self.assertLogs("uvicorn.error", level="WARNING") as logs,
        ):
            with self.assertRaises(WeatherServiceError) as raised:
                self.service.get_weather(
                    community_slug="kaneshie",
                    community_name="Kaneshie",
                    location=self.location,
                )

        self.assertEqual(
            str(raised.exception),
            "Open-Meteo forecast request failed with status 429.",
        )
        joined_logs = "\n".join(logs.output)
        self.assertIn(
            "WeatherAPI forecast request failed for kaneshie via api.weatherapi.com: HTTPError:",
            joined_logs,
        )
        self.assertIn(
            "Open-Meteo fallback request failed for kaneshie via api.open-meteo.com: HTTPError:",
            joined_logs,
        )
        self.assertNotIn(secret_key, joined_logs)

    def test_fetch_weatherapi_forecast_json_logs_timeout_and_raises_safe_backend_error(self) -> None:
        error = socket.timeout("timed out")

        with (
            patch.dict("os.environ", {WEATHER_API_KEY_ENV_VAR: "test-key"}, clear=False),
            self.assertLogs("uvicorn.error", level="WARNING") as logs,
            patch("app.services.weather_service.urlopen", side_effect=error),
        ):
            with self.assertRaises(WeatherServiceTimeoutError) as raised:
                self.service._fetch_weatherapi_forecast_json(
                    self.location,
                    community_slug="kaneshie",
                )

        self.assertEqual(str(raised.exception), "WeatherAPI forecast request timed out.")
        self.assertIn(
            "WeatherAPI forecast request failed for kaneshie via api.weatherapi.com: TimeoutError:",
            logs.output[0],
        )

    def test_fetch_openmeteo_forecast_json_logs_url_error_and_raises_safe_backend_error(self) -> None:
        error = URLError("temporary DNS failure")

        with (
            self.assertLogs("uvicorn.error", level="WARNING") as logs,
            patch("app.services.weather_service.urlopen", side_effect=error),
        ):
            with self.assertRaises(WeatherServiceError) as raised:
                self.service._fetch_openmeteo_forecast_json(
                    self.location,
                    community_slug="kaneshie",
                )

        self.assertEqual(str(raised.exception), "Open-Meteo forecast request failed.")
        self.assertIn(
            "Open-Meteo fallback request failed for kaneshie via api.open-meteo.com: URLError:",
            logs.output[0],
        )


class CurrentRiskRegressionTests(TestCase):
    def setUp(self) -> None:
        FixedDateTime.current_time = datetime(2026, 8, 21, 13, 55)
        self.payload = CurrentRiskPredictRequest(community_slug="kaneshie")
        self.community_row = SimpleNamespace(
            town="Kaneshie",
            features=FeaturePayload(
                elevation_m=12.5,
                slope_deg=1.2,
                drainage_density=0.9,
            ),
        )
        self.location = CommunityLocation(
            community_slug="kaneshie",
            town="Kaneshie",
            latitude=5.57169,
            longitude=-0.23761,
            timezone="Africa/Accra",
            geocoding_source="test",
            review_status="approved",
        )
        self.baseline_prediction = SimpleNamespace(
            flood_probability=0.31,
            risk_percent=31,
            risk_level="low",
            features=self.community_row.features,
        )
        service = WeatherService()
        hourly_points = tuple(
            service._parse_weatherapi_hourly_points(
                build_weatherapi_forecast_payload(),
                self.location.timezone,
            )
        )
        with patch("app.services.weather_service.datetime", FixedDateTime):
            self.weather_response = service._build_response(
                community_slug="kaneshie",
                community_name="Kaneshie",
                location=self.location,
                hourly_points=hourly_points,
            )

    def test_predict_current_risk_returns_hybrid_rule_adjusted(self) -> None:
        weather_assessment = SimpleNamespace(
            precip_probability_6h_max=19.0,
            rain_6h_sum_mm=9.9,
            rain_24h_sum_mm=61.2,
            weather_risk="elevated",
            adjustment=0.05,
            adjustment_percentage_points=5,
            triggered_by=["rain_24h_sum_mm >= 10"],
        )
        adjusted_risk = SimpleNamespace(probability=0.36, risk_percent=36, risk_level="low")

        with (
            patch("app.main.community_service.resolve_slug", return_value=("kaneshie", self.community_row)),
            patch("app.main.model_service.predict_features", return_value=self.baseline_prediction),
            patch("app.main.location_service.get_location", return_value=self.location),
            patch("app.main.weather_service.get_weather", return_value=self.weather_response),
            patch("app.main.weather_risk_service.assess_weather_response", return_value=weather_assessment),
            patch("app.main.weather_risk_service.apply_adjustment", return_value=adjusted_risk),
        ):
            response = predict_current_risk(self.payload)

        self.assertEqual(response.method, "hybrid_rule_adjusted")
        self.assertTrue(response.weather.available)
        self.assertEqual(response.weather.precip_probability_6h_max, 19.0)
        self.assertEqual(response.weather_context.forecast_reference_time, "2026-08-21T13:00:00+00:00")

    def test_predict_current_risk_returns_baseline_only_for_unsupported_weather(self) -> None:
        with (
            patch("app.main.community_service.resolve_slug", return_value=("kaneshie", self.community_row)),
            patch("app.main.model_service.predict_features", return_value=self.baseline_prediction),
            patch(
                "app.main.location_service.get_location",
                side_effect=UnknownCommunityLocationError("Weather is unavailable."),
            ),
        ):
            response = predict_current_risk(self.payload)

        self.assertEqual(response.method, "baseline_only")
        self.assertFalse(response.weather.available)
        self.assertEqual(response.current_risk.risk_percent, 31)

    def test_predict_current_risk_returns_baseline_only_when_provider_fails(self) -> None:
        with (
            patch("app.main.community_service.resolve_slug", return_value=("kaneshie", self.community_row)),
            patch("app.main.model_service.predict_features", return_value=self.baseline_prediction),
            patch("app.main.location_service.get_location", return_value=self.location),
            patch(
                "app.main.weather_service.get_weather",
                side_effect=WeatherServiceError("Open-Meteo forecast request failed."),
            ),
        ):
            response = predict_current_risk(self.payload)

        self.assertEqual(response.method, "baseline_only_weather_unavailable")
        self.assertFalse(response.weather.available)
        self.assertEqual(response.current_risk.risk_percent, 31)


class WeatherEndpointSafetyTests(TestCase):
    def setUp(self) -> None:
        self.community_row = SimpleNamespace(town="Kaneshie")
        self.location = CommunityLocation(
            community_slug="kaneshie",
            town="Kaneshie",
            latitude=5.57169,
            longitude=-0.23761,
            timezone="Africa/Accra",
            geocoding_source="test",
            review_status="approved",
        )

    def test_weather_endpoint_public_error_does_not_expose_api_key_details(self) -> None:
        with (
            patch("app.main.community_service.resolve_slug", return_value=("kaneshie", self.community_row)),
            patch("app.main.location_service.get_location", return_value=self.location),
            patch(
                "app.main.weather_service.get_weather",
                side_effect=WeatherServiceError("WeatherAPI key is not configured."),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                get_community_weather("kaneshie")

        self.assertEqual(raised.exception.status_code, 502)
        self.assertEqual(raised.exception.detail, "Upstream weather request failed.")
        self.assertNotIn("WEATHER_API_KEY", raised.exception.detail)
        self.assertNotIn("WeatherAPI key", raised.exception.detail)
