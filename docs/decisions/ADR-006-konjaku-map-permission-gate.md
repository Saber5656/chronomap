# ADR-006: Konjaku Map provider ships behind a human permission gate

Date: 2026-07-07 / Status: Accepted

## Context

今昔マップ tiles are the only practical source for drawn historical topo maps of Japan, but their
terms require contacting Saitama University before public release of an app using them
(research/konjaku-map-tiles.md §3). Contacting the university and obtaining permission is a human
action outside agent scope.

## Decision

- The Konjaku provider (dataset entries, TMS handling, attribution) is fully implemented in v1
  code (issue 16) but controlled by build-time flag `VITE_ENABLE_KONJAKU`, **default OFF**.
- The flag may be turned ON in a public deployment **only after** the repository owner records
  obtained permission in `docs/decisions/` (amend this ADR with date + scope of permission).
- The release checklist (issue 48) contains an explicit gate item; CI does not set the flag.
- v1 is considered complete and releasable with the flag OFF (GSI aerial axis + POI pins remain).

## Consequences

- No legal exposure from unauthorized tile use; the feature is one flag away once permission lands.
- The time slider must degrade gracefully when a whole provider is disabled (covered by the
  registry-driven design, issue 17/19 — disabled providers simply contribute no layers).
- If permission is denied, the code is removed or kept dormant at the owner's decision; no other
  component depends on the provider's existence.
