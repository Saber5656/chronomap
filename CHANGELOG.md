# Changelog

All notable changes to chronomap are documented here. This file follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) conventions. The `0.1.0` entry is a
release-preparation snapshot; it is intentionally marked unreleased until the human release gates
are completed.

## [0.1.0] - Unreleased

### Added

- A Japan-first time-travel map PWA with a registry-driven historical aerial-photo timeline and
  present-day GSI imagery, as described in [DESIGN §16](docs/DESIGN.md#16-build-cicd-release).
- A provider boundary for Wikipedia/Wikimedia nearby places and article summaries, including
  guarded response handling, attribution, and the privacy boundary for map-center requests.
- Flag-gated Konjaku historical map layers behind `VITE_ENABLE_KONJAKU`, with the ADR-006 human
  permission gate remaining the authority for any public enablement.
- Share-target and URL/paste import flows, outbound map handoff, onboarding, Japanese/English
  interface strings, error/offline states, and an installable app shell.
- CSP and host allowlists, registry validation, security-abuse fixtures, accessibility-oriented
  UI states, and release-time third-party license notices.

### Release preparation

- Added the release go/no-go checklist and the v2 deferred-work tracking artifact.
- Added `npm run smoke:providers`, a manual-only live-provider smoke command with a CI guard,
  explicit request budget, User-Agent headers, sequential at-most-1-request/second pacing, and
  first-error abort.

### Release status

- No tag, GitHub Release, Pages deployment, live smoke run, device matrix, ADR-006 permission
  approval, Pages settings screenshot, or secret scan is claimed by this entry.

[0.1.0]: https://github.com/Saber5656/chronomap/releases/tag/v0.1.0
