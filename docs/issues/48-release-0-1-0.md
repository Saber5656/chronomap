# Title

Release v0.1.0 (checklist-driven)

## Summary

Execute the first public release: CHANGELOG, version tag, deploy verification, manual device
matrix, live-provider smoke, notices refresh, and the go/no-go checklist including the ADR-006
Konjaku gate — closing out v1.

## Context

DESIGN §16 (release) and ISSUE_PLAN §1 (completion statement). Merge ≠ release: this issue is the
explicit release gate with recorded evidence.

## Scope

- `CHANGELOG.md` (Keep a Changelog format): `0.1.0` section summarizing v1 features (link DESIGN).
- Version: `package.json` 0.1.0 (feeds `__APP_VERSION__`), git tag `v0.1.0` on the release commit
  (annotated), GitHub Release with CHANGELOG excerpt.
- THIRD_PARTY_NOTICES.md: fill "Bundled npm packages" via `npx license-checker --production
  --summary` output (record command + output).
- `npm run smoke:providers` script (add): sequential, rate-limited (1 rps) live checks — 1 tile
  per enabled registry layer (expect 200/404-in-coverage-logic), 1 geosearch + 1 summary
  (Tokyo Station) — prints a table; NEVER run in CI (script guards `CI` env and exits with
  notice).
- Release checklist (execute + record results in the issue/PR):
  1. All issues 01–47 closed; ISSUE_PLAN §4 coverage table re-verified against DESIGN.
  2. CI green on main; deployed Pages URL serves the tagged build (`__APP_VERSION__` visible in
     About).
  3. Device matrix (manual, human tester): iOS Safari (latest) — install A2HS, locate, slider,
     POI, import paste, Shortcut recipe end-to-end; Android Chrome — install, share-target from
     Google Maps, geo: link, offline shell. Record OS/browser versions + pass/fail per row.
  4. Live smoke pass (script above) — all rows OK or explained.
  5. ADR-006 gate: confirm `VITE_ENABLE_KONJAKU` state in deploy matches permission status
     (expected OFF unless ADR-006 amended with permission record).
  6. Privacy note (47) re-read against shipped behavior.
  7. Lighthouse (46) numbers recorded from the deployed URL (manual run, real network — field
     reference only).
  8. Repo hygiene: no secrets in history (`gitleaks` or GitHub secret-scanning status recorded),
     Pages settings screenshot, branch protection active.
- Post-release: move v2 deferred list (ISSUE_PLAN §6) into a `v2 ideas` GitHub milestone or
  tracking issue (single derived issue is acceptable).

## Detailed Requirements

1. Human steps (device tests, permission gate, settings screenshots) are explicitly assigned to
   the owner/tester; the issue is not closeable by an agent alone — state this in the issue body.
2. No force-tags; if the release commit changes, bump to 0.1.1.
3. The smoke script's politeness: ≤ 12 total requests, UA header set, abort on first network
   error with clear report.

## Acceptance Criteria

- [ ] Tag `v0.1.0` + GitHub Release published; deployed About shows 0.1.0.
- [ ] Checklist items 1–8 all recorded with evidence (links/log excerpts/screenshots) in the
      issue thread.
- [ ] THIRD_PARTY_NOTICES complete for production deps.
- [ ] v2 tracking artifact created.

## Validation

The checklist IS the validation; evidence recorded in the GitHub issue before closing.

## Dependencies

All of 01–47. Human: device testers, owner settings/screenshots, ADR-006 status.

## Non-goals

Feature work, announcing/marketing, custom domain, store listings.

## Design References

DESIGN §16, §17.5; ISSUE_PLAN §1/§5; ADR-006.
