"""Build deterministic province adjacency JSON for every built-in scenario."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

from shapely.geometry import shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
GEOMETRY_DIR = ROOT / "web" / "src" / "features" / "map" / "geometry"
REGION_METADATA = ROOT / "web" / "src" / "features" / "map" / "east-asia-region-metadata.json"
OUTPUT_DIR = ROOT / "src" / "domain" / "scenario" / "adjacency"
ISO_CODES = ROOT / "node_modules" / "i18n-iso-countries" / "codes.json"
BIOME = ROOT / "node_modules" / ".bin" / ("biome.exe" if os.name == "nt" else "biome")
BUFFER_DEGREES = 0.000_01
SNAPSHOTS = {
    "scn_bronze_1200bc": "world_bc1000",
    "scn_classical_117": "world_100",
    "scn_medieval_1200": "world_1200",
    "scn_steppe_1300": "world_1300",
    "scn_trade_1650": "world_1650",
    "scn_world_1939": "world_1938",
    "scn_coldwar_1962": "world_1960",
    "scn_modern": "world_2010",
    "scn_reconstruction_2281": "world_2010",
}


def base36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    result = ""
    while value:
        value, remainder = divmod(value, 36)
        result = digits[remainder] + result
    return result or "0"


def stable_hash(value: str) -> str:
    result = 2_166_136_261
    for character in unicodedata.normalize("NFKC", value):
        code_unit = int.from_bytes(character.encode("utf-16-le")[:2], "little")
        result = ((result ^ code_unit) * 16_777_619) & 0xFFFF_FFFF
    return base36(result)


def historical_province_id(source_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", source_name)
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    slug = re.sub(r"[^a-z0-9]+", "_", without_marks.lower().replace("&", " and ")).strip("_")[:44]
    return f"prv_hist_{slug or 'unnamed'}_{stable_hash(source_name)}"


def grouped_geometries(
    features: list[dict], id_property: str, invalid_labels: list[str] | None = None
) -> dict[str, object]:
    by_id: dict[str, list[object]] = defaultdict(list)
    for index, feature in enumerate(features):
        properties = feature.get("properties", {})
        source_id = properties.get(id_property)
        if not isinstance(source_id, str) or not source_id.strip():
            continue
        try:
            geometry = shape(feature["geometry"])
        except (TypeError, ValueError) as error:
            if invalid_labels is None:
                raise
            print(
                f"warning: skipped invalid local geometry {invalid_labels[index]} "
                f"({id_property}={source_id!r}): {error}",
                file=sys.stderr,
            )
            continue
        by_id[source_id.strip()].append(geometry if geometry.is_valid else geometry.buffer(0))
    return {province_id: unary_union(parts) for province_id, parts in by_id.items()}


def local_east_asia_geometries() -> dict[str, object]:
    features: list[dict] = []
    labels: list[str] = []
    for path in sorted(GEOMETRY_DIR.glob("*.json")):
        collection = json.loads(path.read_text(encoding="utf-8"))
        for index, feature in enumerate(collection.get("features", [])):
            features.append(feature)
            labels.append(f"{path.relative_to(ROOT)} feature[{index}]")
    return grouped_geometries(features, "provinceId", labels)


def historical_geometries(snapshot: str) -> dict[str, object]:
    url = (
        "https://raw.githubusercontent.com/aourednik/historical-basemaps/"
        f"master/geojson/{snapshot}.geojson"
    )
    with urlopen(url, timeout=30) as response:
        collection = json.load(response)
    features = []
    for feature in collection.get("features", []):
        source_name = feature.get("properties", {}).get("NAME")
        if not isinstance(source_name, str) or not source_name.strip():
            continue
        features.append(
            {
                **feature,
                "properties": {"provinceId": historical_province_id(source_name.strip())},
            }
        )
    return grouped_geometries(features, "provinceId")


def build_adjacency(geometries: dict[str, object]) -> dict[str, list[str]]:
    province_ids = sorted(geometries)
    buffered = {
        province_id: geometries[province_id].buffer(BUFFER_DEGREES)
        for province_id in province_ids
    }
    adjacency = {province_id: set() for province_id in province_ids}
    # ponytail: O(n²) is sufficient for one-off maps; use STRtree if the map count grows sharply.
    for left_index, left_id in enumerate(province_ids):
        for right_id in province_ids[left_index + 1 :]:
            left = geometries[left_id]
            right = geometries[right_id]
            if left.touches(right) or buffered[left_id].intersects(buffered[right_id]):
                adjacency[left_id].add(right_id)
                adjacency[right_id].add(left_id)
    return {province_id: sorted(neighbors) for province_id, neighbors in adjacency.items()}


def historical_adjacency(snapshot: str) -> dict[str, list[str]]:
    adjacency = build_adjacency(historical_geometries(snapshot))
    codes = json.loads(ISO_CODES.read_text(encoding="utf-8"))
    for code in codes:
        adjacency.setdefault(f"prv_{code[1].lower()}_adm0", [])
    return dict(sorted(adjacency.items()))


def edge_count(adjacency: dict[str, list[str]]) -> int:
    return sum(map(len, adjacency.values())) // 2


def curated_east_asia_adjacency() -> dict[str, list[str]]:
    regions = json.loads(REGION_METADATA.read_text(encoding="utf-8"))
    adjacency = {region["id"]: set(region["neighbors"]) for region in regions}
    for province_id, neighbors in list(adjacency.items()):
        for neighbor_id in neighbors:
            adjacency[neighbor_id].add(province_id)
    return {province_id: sorted(neighbors) for province_id, neighbors in adjacency.items()}


def write_adjacency(scenario_id: str, adjacency: dict[str, list[str]]) -> None:
    path = OUTPUT_DIR / f"{scenario_id}.json"
    with path.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(dict(sorted(adjacency.items())), output, ensure_ascii=False, indent=2)
        output.write("\n")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    computed_east_asia = build_adjacency(local_east_asia_geometries())
    east_asia = curated_east_asia_adjacency()
    write_adjacency("scn_ea1900", east_asia)
    print(
        f"scn_ea1900: {len(east_asia)} provinces / {edge_count(east_asia)} "
        f"undirected edges (checked {len(computed_east_asia)} local geometries)"
    )
    by_snapshot: dict[str, dict[str, list[str]]] = {}
    for scenario_id, snapshot in SNAPSHOTS.items():
        if snapshot not in by_snapshot:
            by_snapshot[snapshot] = historical_adjacency(snapshot)
        adjacency = by_snapshot[snapshot]
        write_adjacency(scenario_id, adjacency)
        print(
            f"{scenario_id}: {len(adjacency)} provinces / {edge_count(adjacency)} "
            "undirected edges"
        )
    subprocess.run(
        [
            BIOME,
            "format",
            "--write",
            OUTPUT_DIR / "scn_ea1900.json",
            *(OUTPUT_DIR / f"{scenario_id}.json" for scenario_id in SNAPSHOTS),
        ],
        check=True,
        cwd=ROOT,
    )


if __name__ == "__main__":
    main()
