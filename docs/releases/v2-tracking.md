# chronomap v2 tracking artifact

Status: **deferred; tracking only**
Source of truth: [`docs/ISSUE_PLAN.md` §6](../ISSUE_PLAN.md#6-deferred-to-v2-do-not-implement-in-v1)
Created for: Issue #49 release preparation

This document records v2 candidates without implementing them and without claiming that a GitHub
milestone or tracking issue has been created. The owner may later map each row to a GitHub issue or
milestone after the v1 release gate is complete.

| ID | Deferred capability | Why it is deferred | Status | Next human planning action |
|---|---|---|---|---|
| V2-001 | OpenHistoricalMap `vector-dated` provider and world basemap | Different provider/data model from v1 raster-era layers; requires separate coverage, rendering, and terms review. | DEFERRED | Create a scoped design/issue after confirming provider terms and vector rendering budget. |
| V2-002 | Geocoding search | Not required for v1 map-center/URL import flows. | DEFERRED | Define provider, privacy disclosure, rate limit, and fallback behavior. |
| V2-003 | Device-local bookmarks | Persistence and privacy policy are intentionally outside the v1 app shell. | DEFERRED | Decide storage/clear/export semantics and offline behavior. |
| V2-004 | Wikidata date-filtered POIs | v1 presents nearby places without promising historical-date filtering. | DEFERRED | Define date confidence, language, and empty-result UX. |
| V2-005 | Swipe/compare view | v1 uses a lightweight opacity control; split comparison was explicitly deferred. | DEFERRED | Specify gesture/accessibility behavior and performance budget. |
| V2-006 | Capacitor wrapper and native iOS share target | Native share extensions require a wrapper app; v1 uses Shortcuts plus paste fallback. | DEFERRED | Confirm distribution targets, signing ownership, and native privacy surface. |
| V2-007 | DMS coordinate parsing | v1 accepts the supported URL/decimal coordinate contract only. | DEFERRED | Add a grammar, ambiguity rules, and abuse/security fixtures. |
| V2-008 | Optional last-view restore | Session restoration is not part of the v1 privacy and state contract. | DEFERRED | Decide opt-in, retention, and reset behavior. |
| V2-009 | Promote Commons old-photo strip out of its flag | v1 Commons work is best-effort/flag-gated because metadata quality and licensing vary. | DEFERRED | Reassess metadata coverage, per-file license UI, and attribution obligations. |

## Known-unknown follow-ups

These are release-adjacent questions from DESIGN §17. They are not silently converted into v1
implementation work:

| Topic | Current handling |
|---|---|
| Konjaku permission outcome and tile CORS/hotlink behavior | Human ADR-006 gate; no public enablement until permission is recorded. |
| Exact per-layer GSI attribution and coverage fidelity | Existing v1 approximation remains subject to owner verification/refinement. |
| MapLibre versus strict CSP details | Keep the existing policy and open a scoped issue if deployment evidence requires a change. |
| Google Maps share URL drift | Add parser fixtures/issues only when a concrete format is observed. |
| iOS standalone-PWA geolocation quirks | Human device matrix at release; do not infer from desktop tests. |

No v2 feature, GitHub milestone, or GitHub tracking issue is complete by virtue of this artifact.
