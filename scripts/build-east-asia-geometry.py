# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "numpy>=2.0",
#   "shapely>=2.0",
# ]
# ///

"""Build dissolved East Asia campaign geometry from licensed geoBoundaries ADM1 data."""

from __future__ import annotations

import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from shapely import make_valid
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEOMETRY_DIR = ROOT / "web" / "src" / "features" / "map" / "geometry"
ARCHIVE_COMMIT = "9469f09"
COUNTRIES = ("KOR", "PRK", "JPN", "CHN", "RUS")
SOURCE_TEMPLATE = (
    "https://github.com/wmgeolab/geoBoundaries/raw/"
    f"{ARCHIVE_COMMIT}/releaseData/gbOpen/{{iso}}/ADM1/"
    "geoBoundaries-{iso}-ADM1_simplified.geojson"
)
SIMPLIFY_TOLERANCE_DEGREES = 0.025

JsonObject = dict[str, Any]


def load_assignments() -> dict[tuple[str, str], str]:
    assignments: dict[tuple[str, str], str] = {}
    for iso in COUNTRIES:
        source_path = GEOMETRY_DIR / f"{iso.lower()}-adm1.json"
        collection = json.loads(source_path.read_text(encoding="utf-8"))
        for feature in collection["features"]:
            properties = feature["properties"]
            assignments[(iso, properties["sourceName"])] = properties["provinceId"]
    return assignments


def fetch_collection(iso: str) -> JsonObject:
    request = urllib.request.Request(
        SOURCE_TEMPLATE.format(iso=iso),
        headers={"User-Agent": "Pax-Historia-geometry-builder/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.load(response)


def round_coordinates(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 5)
    if isinstance(value, list):
        return [round_coordinates(item) for item in value]
    if isinstance(value, tuple):
        return [round_coordinates(item) for item in value]
    if isinstance(value, dict):
        return {key: round_coordinates(item) for key, item in value.items()}
    return value


def build_collection() -> JsonObject:
    assignments = load_assignments()
    grouped_geometry: defaultdict[str, list[Any]] = defaultdict(list)
    grouped_sources: defaultdict[str, list[str]] = defaultdict(list)
    grouped_iso: defaultdict[str, set[str]] = defaultdict(set)

    for iso in COUNTRIES:
        collection = fetch_collection(iso)
        for feature in collection["features"]:
            source_name = feature["properties"]["shapeName"]
            province_id = assignments.get((iso, source_name))
            if province_id is None:
                continue
            geometry = make_valid(shape(feature["geometry"]))
            if geometry.is_empty:
                continue
            grouped_geometry[province_id].append(geometry)
            grouped_sources[province_id].append(source_name)
            grouped_iso[province_id].add(iso)

    features: list[JsonObject] = []
    point_counts: list[int] = []
    for province_id in sorted(grouped_geometry):
        dissolved = make_valid(unary_union(grouped_geometry[province_id]))
        simplified = dissolved.simplify(
            SIMPLIFY_TOLERANCE_DEGREES, preserve_topology=True
        )
        label_point = simplified.representative_point()
        min_x, min_y, max_x, max_y = simplified.bounds
        geometry_json = round_coordinates(mapping(simplified))
        coordinates_text = json.dumps(
            geometry_json["coordinates"], separators=(",", ":")
        )
        point_counts.append(coordinates_text.count("],[") + 1)
        features.append(
            {
                "type": "Feature",
                "id": province_id,
                "properties": {
                    "provinceId": province_id,
                    "sourceIso": sorted(grouped_iso[province_id]),
                    "sourceNames": sorted(grouped_sources[province_id]),
                    "labelAnchor": [round(label_point.x, 5), round(label_point.y, 5)],
                    "bounds": [
                        round(min_x, 5),
                        round(min_y, 5),
                        round(max_x, 5),
                        round(max_y, 5),
                    ],
                },
                "geometry": geometry_json,
            }
        )

    if len(features) != 25:
        raise RuntimeError(f"expected 25 campaign regions, built {len(features)}")
    print(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    )
    print(
        json.dumps(
            {
                "features": len(features),
                "verticesMin": int(np.min(point_counts)),
                "verticesMedian": float(np.median(point_counts)),
                "verticesMax": int(np.max(point_counts)),
            }
        ),
        file=sys.stderr,
    )


if __name__ == "__main__":
    build_collection()
