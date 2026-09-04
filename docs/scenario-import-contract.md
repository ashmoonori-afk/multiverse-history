# Scenario package import contract

`POST /api/catalog/scenarios/import` validates a complete package before
returning `201`. The endpoint is memory-only and does not write package files.

Each package uses `schemaVersion: 1`, a `scn_*` identifier, at least one
canonical-country nation, at least one closed `Polygon` region, SPDX license
metadata, and a `canonicalHash` computed over the package without the hash
field.

The API rejects malformed or empty JSON with `400 invalid_request`, oversized
payloads with `413 scenario_package_too_large`, and semantic/hash failures with
recoverable `422` codes:

- `scenario_package_hash_mismatch`
- `scenario_unknown_country`
- `scenario_duplicate_nation_id`
- `scenario_duplicate_region_id`
- `scenario_invalid_geometry`
- `scenario_unlicensed_external_asset`

Rejected packages cannot mutate the built-in catalog or the active campaign
state. The adversarial contract is locked by
`tests/api/scenario-import-errors.integration.test.ts`.
