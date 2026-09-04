from __future__ import annotations

import csv
import json
import socket
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.community_service import slugify_town_name

SOURCE_DATA_PATH = BACKEND_ROOT / "data" / "accra_town_features.csv"
CANDIDATE_OUTPUT_PATH = BACKEND_ROOT / "data" / "community_location_candidates.csv"
CANONICAL_OUTPUT_PATH = BACKEND_ROOT / "data" / "community_locations.csv"
GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search"
REQUEST_TIMEOUT_SECONDS = 10
MAX_RESULTS_PER_QUERY = 5
QUERY_SUFFIX = "Greater Accra"
PLACEHOLDER_VALUE = ""

MATCH_REVIEW_APPROVED = "approved"
MATCH_REVIEW_MANUAL = "manual_review"
MATCH_REVIEW_NO_RESULT = "no_result"
TARGET_ADMIN1 = "greater accra region"

CANDIDATE_HEADERS = [
    "community_slug",
    "town",
    "query",
    "query_variant",
    "query_rank",
    "candidate_rank",
    "candidate_name",
    "latitude",
    "longitude",
    "country",
    "country_code",
    "admin1",
    "admin2",
    "timezone",
    "population",
    "geocoding_id",
    "geocoding_source",
    "auto_match_status",
    "auto_match_reason",
    "review_status",
]

CANONICAL_HEADERS = [
    "community_slug",
    "town",
    "latitude",
    "longitude",
    "timezone",
    "geocoding_source",
    "review_status",
]


@dataclass(frozen=True)
class CandidateResult:
    town: str
    community_slug: str
    query: str
    query_variant: str
    query_rank: int
    candidate_rank: int
    candidate_name: str
    latitude: float
    longitude: float
    country: str
    country_code: str
    admin1: str
    admin2: str
    timezone: str
    population: str
    geocoding_id: str
    geocoding_source: str

    @property
    def dedupe_key(self) -> tuple[str, str, str, str, str]:
        return (
            self.geocoding_id or PLACEHOLDER_VALUE,
            self.candidate_name.casefold(),
            f"{self.latitude:.6f}",
            f"{self.longitude:.6f}",
            self.admin1.casefold(),
        )


def normalize_name(value: str) -> str:
    return " ".join(slugify_town_name(value).split("-"))


def load_towns() -> list[str]:
    towns: list[str] = []
    seen: set[str] = set()

    with SOURCE_DATA_PATH.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            town = (row.get("town") or "").strip()
            if not town or town in seen:
                continue
            towns.append(town)
            seen.add(town)

    return towns


def fetch_geocoding_results(query: str) -> list[dict[str, object]]:
    params = urlencode(
        {
            "name": query,
            "count": str(MAX_RESULTS_PER_QUERY),
            "language": "en",
            "countryCode": "GH",
        }
    )
    url = f"{GEOCODING_API_URL}?{params}"

    try:
        with urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            if getattr(response, "status", 200) != 200:
                raise RuntimeError(f"Geocoding request failed with status {response.status}.")
            body = response.read()
    except HTTPError as error:
        raise RuntimeError(f"Geocoding request failed with status {error.code}.") from error
    except (socket.timeout, TimeoutError) as error:
        raise RuntimeError("Geocoding request timed out.") from error
    except URLError as error:
        raise RuntimeError("Geocoding request failed.") from error

    payload = json.loads(body.decode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("Geocoding API returned an unexpected payload.")

    results = payload.get("results")
    if results is None:
        return []
    if not isinstance(results, list):
        raise RuntimeError("Geocoding API returned a malformed results array.")

    return [result for result in results if isinstance(result, dict)]


def build_queries(town: str) -> list[tuple[str, str]]:
    return [
        ("exact", town),
        ("greater_accra", f"{town}, {QUERY_SUFFIX}"),
    ]


def extract_candidate_results(town: str) -> list[CandidateResult]:
    slug = slugify_town_name(town)
    candidates: list[CandidateResult] = []
    normalized_town = normalize_name(town)

    for query_rank, (query_variant, query) in enumerate(build_queries(town), start=1):
        results = fetch_geocoding_results(query)
        for candidate_rank, result in enumerate(results, start=1):
            try:
                latitude = float(result["latitude"])
                longitude = float(result["longitude"])
            except Exception:
                continue

            candidates.append(
                CandidateResult(
                    town=town,
                    community_slug=slug,
                    query=query,
                    query_variant=query_variant,
                    query_rank=query_rank,
                    candidate_rank=candidate_rank,
                    candidate_name=str(result.get("name") or PLACEHOLDER_VALUE).strip(),
                    latitude=latitude,
                    longitude=longitude,
                    country=str(result.get("country") or PLACEHOLDER_VALUE).strip(),
                    country_code=str(result.get("country_code") or PLACEHOLDER_VALUE).strip(),
                    admin1=str(result.get("admin1") or PLACEHOLDER_VALUE).strip(),
                    admin2=str(result.get("admin2") or PLACEHOLDER_VALUE).strip(),
                    timezone=str(result.get("timezone") or PLACEHOLDER_VALUE).strip(),
                    population=str(result.get("population") or PLACEHOLDER_VALUE).strip(),
                    geocoding_id=str(result.get("id") or PLACEHOLDER_VALUE).strip(),
                    geocoding_source="open-meteo",
                )
            )

        if any(
            candidate.country.casefold() == "ghana"
            and candidate.admin1.casefold() == TARGET_ADMIN1
            and normalize_name(candidate.candidate_name) == normalized_town
            for candidate in candidates
        ):
            break

    return candidates


def resolve_approval(
    town: str,
    candidates: list[CandidateResult],
) -> tuple[str, str, CandidateResult | None]:
    if not candidates:
        return (
            MATCH_REVIEW_NO_RESULT,
            "Open-Meteo returned no Ghana geocoding candidates for either query.",
            None,
        )

    distinct_candidates: dict[tuple[str, str, str, str, str], CandidateResult] = {}
    for candidate in candidates:
        distinct_candidates.setdefault(candidate.dedupe_key, candidate)

    normalized_town = normalize_name(town)
    exact_matches = [
        candidate
        for candidate in distinct_candidates.values()
        if candidate.country.casefold() == "ghana"
        and candidate.admin1.casefold() == TARGET_ADMIN1
        and normalize_name(candidate.candidate_name) == normalized_town
    ]

    if len(exact_matches) == 1:
        return (
            MATCH_REVIEW_APPROVED,
            "Single unambiguous Ghana geocoding result matched the exact town name.",
            exact_matches[0],
        )

    if len(exact_matches) > 1:
        return (
            MATCH_REVIEW_MANUAL,
            "Multiple distinct Ghana geocoding results matched the town name.",
            None,
        )

    return (
        MATCH_REVIEW_MANUAL,
        "No unambiguous exact Ghana geocoding match was found.",
        None,
    )


def write_candidate_rows(candidate_rows: list[dict[str, str]]) -> None:
    with CANDIDATE_OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CANDIDATE_HEADERS)
        writer.writeheader()
        writer.writerows(candidate_rows)


def write_canonical_rows(canonical_rows: list[dict[str, str]]) -> None:
    with CANONICAL_OUTPUT_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CANONICAL_HEADERS)
        writer.writeheader()
        writer.writerows(canonical_rows)


def main() -> int:
    towns = load_towns()
    candidate_rows: list[dict[str, str]] = []
    canonical_rows: list[dict[str, str]] = []
    review_counter: Counter[str] = Counter()

    for town in towns:
        slug = slugify_town_name(town)
        candidates = extract_candidate_results(town)
        review_status, reason, approved_candidate = resolve_approval(town, candidates)
        review_counter[review_status] += 1

        if not candidates:
            candidate_rows.append(
                {
                    "community_slug": slug,
                    "town": town,
                    "query": PLACEHOLDER_VALUE,
                    "query_variant": PLACEHOLDER_VALUE,
                    "query_rank": PLACEHOLDER_VALUE,
                    "candidate_rank": PLACEHOLDER_VALUE,
                    "candidate_name": PLACEHOLDER_VALUE,
                    "latitude": PLACEHOLDER_VALUE,
                    "longitude": PLACEHOLDER_VALUE,
                    "country": PLACEHOLDER_VALUE,
                    "country_code": PLACEHOLDER_VALUE,
                    "admin1": PLACEHOLDER_VALUE,
                    "admin2": PLACEHOLDER_VALUE,
                    "timezone": PLACEHOLDER_VALUE,
                    "population": PLACEHOLDER_VALUE,
                    "geocoding_id": PLACEHOLDER_VALUE,
                    "geocoding_source": "open-meteo",
                    "auto_match_status": review_status,
                    "auto_match_reason": reason,
                    "review_status": review_status,
                }
            )
            continue

        distinct_approved_key = approved_candidate.dedupe_key if approved_candidate else None

        for candidate in candidates:
            row_review_status = (
                MATCH_REVIEW_APPROVED
                if distinct_approved_key and candidate.dedupe_key == distinct_approved_key
                else MATCH_REVIEW_MANUAL
            )
            candidate_rows.append(
                {
                    "community_slug": candidate.community_slug,
                    "town": candidate.town,
                    "query": candidate.query,
                    "query_variant": candidate.query_variant,
                    "query_rank": str(candidate.query_rank),
                    "candidate_rank": str(candidate.candidate_rank),
                    "candidate_name": candidate.candidate_name,
                    "latitude": f"{candidate.latitude:.6f}",
                    "longitude": f"{candidate.longitude:.6f}",
                    "country": candidate.country,
                    "country_code": candidate.country_code,
                    "admin1": candidate.admin1,
                    "admin2": candidate.admin2,
                    "timezone": candidate.timezone,
                    "population": candidate.population,
                    "geocoding_id": candidate.geocoding_id,
                    "geocoding_source": candidate.geocoding_source,
                    "auto_match_status": review_status,
                    "auto_match_reason": reason,
                    "review_status": row_review_status
                    if review_status == MATCH_REVIEW_APPROVED
                    else review_status,
                }
            )

        if approved_candidate is not None:
            canonical_rows.append(
                {
                    "community_slug": approved_candidate.community_slug,
                    "town": approved_candidate.town,
                    "latitude": f"{approved_candidate.latitude:.6f}",
                    "longitude": f"{approved_candidate.longitude:.6f}",
                    "timezone": approved_candidate.timezone or "Africa/Accra",
                    "geocoding_source": approved_candidate.geocoding_source,
                    "review_status": MATCH_REVIEW_APPROVED,
                }
            )

    write_candidate_rows(candidate_rows)
    write_canonical_rows(canonical_rows)

    towns_with_candidates = review_counter[MATCH_REVIEW_APPROVED] + review_counter[MATCH_REVIEW_MANUAL]
    print(f"total={len(towns)}")
    print(f"towns_with_candidates={towns_with_candidates}")
    print(f"resolved={review_counter[MATCH_REVIEW_APPROVED]}")
    print(f"ambiguous={review_counter[MATCH_REVIEW_MANUAL]}")
    print(f"no_result={review_counter[MATCH_REVIEW_NO_RESULT]}")
    print(f"candidate_csv={CANDIDATE_OUTPUT_PATH}")
    print(f"canonical_csv={CANONICAL_OUTPUT_PATH}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
