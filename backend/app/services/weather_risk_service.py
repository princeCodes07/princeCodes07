from __future__ import annotations

from dataclasses import dataclass

from ..schemas.predict import CommunityWeatherResponse
from .model_service import risk_level


@dataclass(frozen=True)
class WeatherRiskRule:
    severity: str
    adjustment: float


@dataclass(frozen=True)
class WeatherRiskAssessment:
    precip_probability_6h_max: float
    rain_6h_sum_mm: float
    rain_24h_sum_mm: float
    weather_risk: str
    adjustment: float
    triggered_by: list[str]

    @property
    def adjustment_percentage_points(self) -> int:
        return round(self.adjustment * 100)


@dataclass(frozen=True)
class AdjustedRiskResult:
    probability: float
    risk_percent: int
    risk_level: str


SEVERE_RULE = WeatherRiskRule(severity="severe", adjustment=0.15)
HIGH_RULE = WeatherRiskRule(severity="high", adjustment=0.10)
ELEVATED_RULE = WeatherRiskRule(severity="elevated", adjustment=0.05)
LOW_RULE = WeatherRiskRule(severity="low", adjustment=0.00)


class WeatherRiskService:
    def assess_weather(
        self,
        *,
        precip_probability_6h_max: float,
        rain_6h_sum_mm: float,
        rain_24h_sum_mm: float,
    ) -> WeatherRiskAssessment:
        p6 = float(precip_probability_6h_max)
        r6 = float(rain_6h_sum_mm)
        r24 = float(rain_24h_sum_mm)

        severe_triggered_by = self._severe_triggers(p6=p6, r6=r6, r24=r24)
        if severe_triggered_by:
            return WeatherRiskAssessment(
                precip_probability_6h_max=round(p6, 2),
                rain_6h_sum_mm=round(r6, 2),
                rain_24h_sum_mm=round(r24, 2),
                weather_risk=SEVERE_RULE.severity,
                adjustment=SEVERE_RULE.adjustment,
                triggered_by=severe_triggered_by,
            )

        high_triggered_by = self._threshold_triggers(
            p6=p6,
            r6=r6,
            r24=r24,
            p6_threshold=60,
            r6_threshold=15,
            r24_threshold=25,
        )
        if high_triggered_by:
            return WeatherRiskAssessment(
                precip_probability_6h_max=round(p6, 2),
                rain_6h_sum_mm=round(r6, 2),
                rain_24h_sum_mm=round(r24, 2),
                weather_risk=HIGH_RULE.severity,
                adjustment=HIGH_RULE.adjustment,
                triggered_by=high_triggered_by,
            )

        elevated_triggered_by = self._threshold_triggers(
            p6=p6,
            r6=r6,
            r24=r24,
            p6_threshold=40,
            r6_threshold=5,
            r24_threshold=10,
        )
        if elevated_triggered_by:
            return WeatherRiskAssessment(
                precip_probability_6h_max=round(p6, 2),
                rain_6h_sum_mm=round(r6, 2),
                rain_24h_sum_mm=round(r24, 2),
                weather_risk=ELEVATED_RULE.severity,
                adjustment=ELEVATED_RULE.adjustment,
                triggered_by=elevated_triggered_by,
            )

        return WeatherRiskAssessment(
            precip_probability_6h_max=round(p6, 2),
            rain_6h_sum_mm=round(r6, 2),
            rain_24h_sum_mm=round(r24, 2),
            weather_risk=LOW_RULE.severity,
            adjustment=LOW_RULE.adjustment,
            triggered_by=[],
        )

    def assess_weather_response(self, weather: CommunityWeatherResponse) -> WeatherRiskAssessment:
        features = weather.model_weather_features
        return self.assess_weather(
            precip_probability_6h_max=features.precip_probability_6h_max,
            rain_6h_sum_mm=features.rain_6h_sum_mm,
            rain_24h_sum_mm=features.rain_24h_sum_mm,
        )

    def apply_adjustment(
        self,
        *,
        baseline_probability: float,
        weather_adjustment: float,
    ) -> AdjustedRiskResult:
        probability = min(1.0, float(baseline_probability) + float(weather_adjustment))
        rounded_probability = round(probability, 4)

        return AdjustedRiskResult(
            probability=rounded_probability,
            risk_percent=round(rounded_probability * 100),
            risk_level=risk_level(rounded_probability),
        )

    def _severe_triggers(self, *, p6: float, r6: float, r24: float) -> list[str]:
        if p6 < 80:
            return []
        if r6 < 25 and r24 < 40:
            return []

        triggered_by = ["precip_probability_6h_max >= 80"]
        if r6 >= 25:
            triggered_by.append("rain_6h_sum_mm >= 25")
        if r24 >= 40:
            triggered_by.append("rain_24h_sum_mm >= 40")
        return triggered_by

    def _threshold_triggers(
        self,
        *,
        p6: float,
        r6: float,
        r24: float,
        p6_threshold: float,
        r6_threshold: float,
        r24_threshold: float,
    ) -> list[str]:
        triggered_by: list[str] = []
        if p6 >= p6_threshold:
            triggered_by.append(f"precip_probability_6h_max >= {int(p6_threshold)}")
        if r6 >= r6_threshold:
            triggered_by.append(f"rain_6h_sum_mm >= {int(r6_threshold)}")
        if r24 >= r24_threshold:
            triggered_by.append(f"rain_24h_sum_mm >= {int(r24_threshold)}")
        return triggered_by


weather_risk_service = WeatherRiskService()
