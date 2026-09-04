# Global Scenario and Country Contract

## Purpose

Every built-in or imported scenario must be independently authored, licensed,
validated, globally selectable, and playable without borrowing proprietary or
unlicensed community content.

## Canonical countries

- Source package: `i18n-iso-countries` under MIT.
- Canonical key: ISO 3166-1 alpha-2.
- Stored attributes: alpha-2, alpha-3, numeric code, Korean display name, English
  display name, and deterministic nation ID.
- Geometry joins through the numeric code in the MIT-compatible runtime adapter;
  the canonical domain does not depend on a renderer.
- Missing historical detail uses deterministic neutral fallbacks for capital
  label, treasury, economy, stability, relations, color, and starting actions.
- A scenario may override names, flags, government, territory, resources, and
  history but cannot remove the ability to start any canonical country.
- Historical and fictional polities use scenario-scoped IDs and explicit
  provenance. A custom polity is always local and original.

## Scenario package

The shipped metadata envelope is intentionally small and is validated by
`src/domain/scenario/metadata.ts`:

```text
schema: multiverse-history-scenario/1
id / titleKo / era / genre / year
licenseSpdx
authors[]
sourceManifest[]
assetManifest[]
```

The runtime registry expands each metadata entry into a playable scenario with
all canonical countries, deterministic fallback regions where historical
geography is absent, and the legal economy/diplomacy/military action set. The
authored 1900 East Asia geography is retained alongside those fallbacks. The
strict package import boundary is documented in
`docs/scenario-import-contract.md` and validates canonical hashes, closed
polygon geometry, duplicate IDs, canonical countries, licenses, and payload
size before accepting a package.

Required license fields describe the package and every non-code asset separately.
Integrity hashes do not substitute for copyright permission.

## Runtime geography and strategic profiles

- Every province carries a Korean name, symmetric valid adjacency, capital and
  port flags, terrain, development, ownership and population.
- Each major polity has exactly one capital and an era-appropriate government,
  tags, manpower and strategic profile. Authored initial units must reference
  provinces owned by their nation.
- Historical scenarios provide authored major-polity resources and profiles;
  non-major fallback polities remain deterministic and playable.
- `scripts/build-adjacency.py` regenerates
  `src/domain/scenario/adjacency/*.json` from renderer geometry. These graph
  files are generated domain assets and are never hand-edited; renderer
  geometry remains owned by `web/`.
- Planner context includes the selected era persona and historical baseline,
  plus bounded profile data for major NPCs.

## Campaign state compatibility

The canonical aggregate is CampaignState schema v2. Import accepts a v1 export
only after verifying its legacy canonical hash, migrates it to v2 defaults, and
recomputes the v2 state hash. Any state-shape or canonical-ordering change must
account for this migration and export compatibility.

## Built-in catalog

The first complete catalog is independently authored from public-domain facts:

1. `청동기 붕괴 — 기원전 1200년`
2. `제국의 절정 — 서기 117년`
3. `실크로드의 세계 — 1200년`
4. `초원의 세기 — 1300년`
5. `대항해와 교역 — 1650년`
6. `1900 동아시아`
7. `세계대전의 문턱 — 1939년`
8. `냉전의 균형 — 1962년`
9. `오늘의 세계`
10. `재건기 2281` — original post-collapse setting with no franchise references.

## Validation

The package validator rejects an unknown schema, duplicate IDs, missing license,
invalid geometry, unlicensed external assets, malformed package identifiers,
unknown countries, tampered hashes, and oversized payloads. Runtime scenario
creation additionally rejects unknown player countries and preserves canonical
state shape through the campaign parser.

For every canonical country and built-in scenario, validation must prove:

- a stable nation ID;
- selectable nation metadata;
- at least one controlled region and capital fallback;
- initial resources, stability, relations, and legal action set;
- deterministic color/flag fallback;
- successful turn-zero campaign creation.

## Feature parity

`docs/feature-matrix.json` maps every required non-multiplayer strategy feature to
its domain, API, UI, automated test, and real-surface evidence. Pax-parity
verification is recorded under `.omo/evidence/pax-parity/`, including the v1
HTTP import, unified 90-day advance, compatibility adapters, save slots and
375/768/1280/200%-zoom browser captures.
No multiplayer route, state, control, or placeholder is allowed.
The map surface renders clickable, hoverable faction overlays with a color
legend and nation-panel selection for every playable nation.
