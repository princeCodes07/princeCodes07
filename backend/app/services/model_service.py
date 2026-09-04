from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from ..schemas.predict import FeaturePayload, PredictRequest, PredictResponse

DEFAULT_FEATURES = ["elevation_m", "slope_deg", "drainage_density"]
logger = logging.getLogger(__name__)


def risk_level(probability: float) -> str:
    if probability >= 0.67:
        return "high"
    if probability >= 0.34:
        return "moderate"
    return "low"


class ModelService:
    def __init__(self) -> None:
        self._model: Any | None = None
        self._features: list[str] = DEFAULT_FEATURES.copy()
        self._load_error: Exception | None = None
        self._model_path = (
            Path(__file__).resolve().parents[2] / "models" / "flood_model.pkl"
        )
        self._load_model()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def features(self) -> list[str]:
        return self._features.copy()

    @property
    def load_error(self) -> Exception | None:
        return self._load_error

    def _load_model(self) -> None:
        try:
            if not self._model_path.exists():
                raise FileNotFoundError(f"Model file was not found: {self._model_path.name}")
            self._model = joblib.load(self._model_path)
            if hasattr(self._model, "feature_names_in_"):
                self._features = [str(feature) for feature in self._model.feature_names_in_]
            else:
                self._features = DEFAULT_FEATURES.copy()
        except Exception as error:  # pragma: no cover - defensive startup path
            self._model = None
            self._features = DEFAULT_FEATURES.copy()
            self._load_error = error
            logger.exception("Flood model failed to load during backend startup.")

    def _ensure_loaded(self) -> Any:
        if self._model is None:
            if self._load_error is not None:
                raise RuntimeError("Model is not available.") from self._load_error
            raise RuntimeError("Model is not available.")
        return self._model

    def _predict_from_values(self, values: dict[str, float]) -> PredictResponse:
        model = self._ensure_loaded()
        ordered_values = {feature: values[feature] for feature in self._features}
        frame = pd.DataFrame([ordered_values])

        probability = float(model.predict_proba(frame)[0][1])

        return PredictResponse(
            flood_probability=round(probability, 4),
            risk_percent=round(probability * 100),
            risk_level=risk_level(probability),
            features=FeaturePayload(**ordered_values),
        )

    def predict(self, payload: PredictRequest) -> PredictResponse:
        values = {
            "elevation_m": float(payload.elevation_m),
            "slope_deg": float(payload.slope_deg),
            "drainage_density": float(payload.drainage_density),
        }
        return self._predict_from_values(values)

    def predict_features(self, features: FeaturePayload) -> PredictResponse:
        values = {
            "elevation_m": float(features.elevation_m),
            "slope_deg": float(features.slope_deg),
            "drainage_density": float(features.drainage_density),
        }
        return self._predict_from_values(values)


model_service = ModelService()
