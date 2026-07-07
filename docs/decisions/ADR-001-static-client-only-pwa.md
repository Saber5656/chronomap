# ADR-001: Static client-only PWA, no backend

Date: 2026-07-07 / Status: Accepted

## Context

chronomap v1 is a read-only viewer (confirmed requirement). All data sources (GSI tiles,
Konjaku Map tiles, Wikimedia APIs) are public, keyless, CORS-usable services. The project is an
open-source release by a single maintainer; operational burden and security surface must be minimal.

## Decision

v1 is a fully static single-page PWA served from GitHub Pages. No server-side code, no database,
no proxy, no API keys, no accounts, no analytics. All third-party requests go directly from the
user's browser to the upstream providers.

## Consequences

- Zero secrets exist anywhere in the system → whole classes of risk (credential leakage, server
  compromise, data breach) are eliminated by construction.
- Geolocation and view state never touch project-owned infrastructure (privacy: ADR-005).
- We cannot hide or throttle upstream APIs behind a proxy; client-side politeness policies are
  mandatory (research/wikimedia-geodata-api.md §4) and upstream outages surface directly (issue 40).
- HTTP response headers are not controllable on GitHub Pages → CSP must be delivered via
  `<meta http-equiv>` with documented limitations (issue 43).
- Rejected alternatives: Cloudflare Pages/Workers proxy (adds an operable component and a place
  to accumulate user data; revisit only if an upstream requires keys or blocks CORS).
