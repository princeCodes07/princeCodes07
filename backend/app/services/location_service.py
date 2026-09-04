from __future__ import annotations

import csv
import logging
import math
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

REQUIRED_COLUMNS = {
    "community_slug",
    "town",
    "latitude",
    "longitude",
    "timezone",
    "geocoding_source",
    "review_status",
}
APPROVED_REVIEW_STATUS = "approved"
logger = logging.getLogger(__name__)


class CommunityLocationConfigurationError(RuntimeError):
    """Raised when the reviewed community location dataset is malformed."""


class UnknownCommunityLocationError(ValueError):
    """Raised when a community has no approved production coordinates."""


@dataclass(frozen=True)
class CommunityLocation:
    community_slug: str
    town: str
    latitude: float
    longitude: float
    timezone: str
    geocoding_source: str
    review_status: str


class CommunityLocationService:
    def __init__(self) -> None:
        self._data_path = Path(__file__).resolve().parents[2] / "data" / "community_locations.csv"
        self._locations: dict[str, CommunityLocation] = {}
        self._load_error: Exception | None = None
        self._load_data()

    @property
    def is_loaded(self) -> bool:
        return bool(self._locations)

    @property
    def load_error(self) -> Exception | None:
        return self._load_error

    def has_location(self, community_slug: str) -> bool:
        return community_slug.strip().lower() in self._locations

    def get_location(self, community_slug: str) -> CommunityLocation:
        normalized_slug = community_slug.strip().lower()

        if self._load_error is not None:
            raise CommunityLocationConfigurationError(
                "Reviewed community locations are unavailable."
            ) from self._load_error

        location = self._locations.get(normalized_slug)
        if location is None:
            raise UnknownCommunityLocationError(
                f"Weather is not available for community slug '{normalized_slug}'."
            )

        return location

    def _load_data(self) -> None:
        if not self._data_path.exists():
            self._locations = {}
            self._load_error = None
            return

        try:
            with self._data_path.open(newline="", encoding="utf-8-sig") as handle:
                reader = csv.DictReader(handle)
                columns = set(reader.fieldnames or [])
                missing_columns = REQUIRED_COLUMNS - columns
                if missing_columns:
                    missing_display = ", ".join(sorted(missing_columns))
                    raise CommunityLocationConfigurationError(
                        "Community locations CSV is missing required columns: "
                        f"{missing_display}"
                    )

                locations: dict[str, CommunityLocation] = {}
                for row in reader:
                    review_status = (row.get("review_status") or "").strip().lower()
                    if review_status != APPROVED_REVIEW_STATUS:
                        continue

                    slug = (row.get("community_slug") or "").strip().lower()
                    town = (row.get("town") or "").strip()
                    timezone = (row.get("timezone") or "").strip()
                    geocoding_source = (row.get("geocoding_source") or "").strip()

                    if not slug or not town or not timezone or not geocoding_source:
                        raise CommunityLocationConfigurationError(
                            "Community locations CSV contains an incomplete approved row."
                        )

                    if slug in locations:
                        raise CommunityLocationConfigurationError(
                            f"Duplicate approved community location slug '{slug}' found."
                        )

                    try:
                        latitude = float(row["latitude"])
                        longitude = float(row["longitude"])
                    except Exception as error:
                        raise CommunityLocationConfigurationError(
                            f"Community locations CSV contains invalid coordinates for '{town}'."
                        ) from error

                    if not math.isfinite(latitude) or not math.isfinite(longitude):
                        raise CommunityLocationConfigurationError(
                            f"Community locations CSV contains non-finite coordinates for '{town}'."
                        )
                    if not -90 <= latitude <= 90:
                        raise CommunityLocationConfigurationError(
                            f"Community locations CSV latitude is out of range for '{town}'."
                        )
                    if not -180 <= longitude <= 180:
                        raise CommunityLocationConfigurationError(
                            f"Community locations CSV longitude is out of range for '{town}'."
                        )

                    try:
                        ZoneInfo(timezone)
                    except Exception as error:
                        raise CommunityLocationConfigurationError(
                            f"Community locations CSV contains an invalid timezone for '{town}'."
                        ) from error

                    locations[slug] = CommunityLocation(
                        community_slug=slug,
                        town=town,
                        latitude=latitude,
                        longitude=longitude,
                        timezone=timezone,
                        geocoding_source=geocoding_source,
                        review_status=review_status,
                    )

            self._locations = locations
            self._load_error = None
        except Exception as error:
            self._locations = {}
            self._load_error = error
            logger.exception("Community location data failed to load during backend startup.")


location_service = CommunityLocationService()
