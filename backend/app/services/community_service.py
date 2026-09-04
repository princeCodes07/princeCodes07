from __future__ import annotations

import csv
import math
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from ..schemas.predict import CommunitySummary, FeaturePayload

REQUIRED_COLUMNS = {"town", "elevation_m", "slope_deg", "drainage_density"}
DASH_EQUIVALENTS = {
    "\u2010": "-",
    "\u2011": "-",
    "\u2012": "-",
    "\u2013": "-",
    "\u2014": "-",
    "\u2015": "-",
    "–": "-",
    "—": "-",
    "â€“": "-",
    "â€”": "-",
}


class UnknownCommunitySlugError(ValueError):
    """Raised when a slug is not recognized by the backend community index."""


class CommunityConfigurationError(RuntimeError):
    """Raised when backend community data consistency is broken."""


@dataclass(frozen=True)
class CommunityFeatureRow:
    slug: str
    town: str
    features: FeaturePayload


def slugify_town_name(town: str) -> str:
    text = town.strip()
    for source, target in DASH_EQUIVALENTS.items():
        text = text.replace(source, target)
    text = text.replace("&", " and ")
    text = re.sub(r"[’'`]+", "", text)
    text = re.sub(r"\s+", " ", text)

    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower())
    slug = re.sub(r"-+", "-", slug).strip("-")

    if not slug:
        raise CommunityConfigurationError(
            f"Unable to generate a valid slug for CSV town '{town}'."
        )

    return slug


class CommunityService:
    def __init__(self) -> None:
        self._data_path = Path(__file__).resolve().parents[2] / "data" / "accra_town_features.csv"
        self._slug_rows: dict[str, CommunityFeatureRow] = {}
        self._community_summaries: list[CommunitySummary] = []
        self._load_data()

    @property
    def is_loaded(self) -> bool:
        return bool(self._slug_rows)

    @property
    def community_count(self) -> int:
        return len(self._community_summaries)

    def list_communities(self) -> list[CommunitySummary]:
        return self._community_summaries.copy()

    def _load_data(self) -> None:
        with self._data_path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            columns = set(reader.fieldnames or [])
            missing_columns = REQUIRED_COLUMNS - columns
            if missing_columns:
                missing_display = ", ".join(sorted(missing_columns))
                raise CommunityConfigurationError(
                    f"Community CSV is missing required columns: {missing_display}"
                )

            rows: dict[str, CommunityFeatureRow] = {}
            collisions: dict[str, list[str]] = {}
            for row in reader:
                town = (row.get("town") or "").strip()
                if not town:
                    raise CommunityConfigurationError("Community CSV contains an empty town value.")

                try:
                    features = FeaturePayload(
                        elevation_m=float(row["elevation_m"]),
                        slope_deg=float(row["slope_deg"]),
                        drainage_density=float(row["drainage_density"]),
                    )
                except Exception as error:
                    raise CommunityConfigurationError(
                        f"Community CSV contains invalid numeric feature data for town '{town}'."
                    ) from error

                if not all(
                    math.isfinite(value)
                    for value in (
                        features.elevation_m,
                        features.slope_deg,
                        features.drainage_density,
                    )
                ):
                    raise CommunityConfigurationError(
                        f"Community CSV contains non-finite numeric feature data for town '{town}'."
                    )

                slug = slugify_town_name(town)
                existing_row = rows.get(slug)
                if existing_row is not None:
                    collisions.setdefault(slug, [existing_row.town])
                    if town not in collisions[slug]:
                        collisions[slug].append(town)
                    continue

                rows[slug] = CommunityFeatureRow(slug=slug, town=town, features=features)

        if collisions:
            collision_messages = [
                f"'{slug}': {', '.join(sorted(towns))}"
                for slug, towns in sorted(collisions.items())
            ]
            raise CommunityConfigurationError(
                "Generated community slug collisions detected. "
                "Resolve them explicitly before serving predictions: "
                + "; ".join(collision_messages)
            )

        self._slug_rows = rows
        self._community_summaries = [
            CommunitySummary(slug=row.slug, name=row.town)
            for row in sorted(rows.values(), key=lambda row: row.town.casefold())
        ]

    def resolve_slug(self, community_slug: str) -> tuple[str, CommunityFeatureRow]:
        normalized_slug = community_slug.strip().lower()
        row = self._slug_rows.get(normalized_slug)
        if row is None:
            raise UnknownCommunitySlugError(
                f"Unknown community slug '{normalized_slug}'."
            )

        return normalized_slug, row


community_service = CommunityService()
