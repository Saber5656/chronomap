# ADR-005: Privacy & security posture — location stays client-side, zero-secret, no user-URL fetching

Date: 2026-07-07 / Status: Accepted

## Context

The app's core input is the user's physical location — the most privacy-sensitive datum a map app
handles. The app also accepts untrusted input (deep-link params, share-sheet payloads, upstream API
JSON). Public OSS release is assumed (threat model: DESIGN §12).

## Decision

Secure defaults, in priority order:

1. **Location never leaves the device toward project infrastructure** (there is none — ADR-001).
   Unavoidable third-party exposure is limited to: tile requests (viewport → tile servers) and
   POI geosearch (map center → Wikimedia, only while POI layer is enabled, zoom ≥13). Both flows
   are disclosed in the in-app privacy note (issue 47). No analytics, no error telemetry in v1.
2. **The app never fetches user-supplied URLs.** Shared links are string-parsed only (issue 34);
   short-link expansion is explicitly unsupported (prevents the app from generating requests to
   attacker-chosen hosts).
3. **All external input is validated at the boundary**: URL params, share payloads and API
   responses pass schema/range validators before entering the store (DESIGN §12.3); external
   strings render via `textContent` only; length caps everywhere.
4. **Zero secrets** anywhere (repo, CI, runtime). CI must not receive any credential beyond the
   default `GITHUB_TOKEN` scoped for Pages deploy.
5. **Network egress allowlist**: CSP `connect-src`/`img-src` enumerate exactly the provider hosts
   from the registries; adding a provider requires touching the CSP (issue 43) — an auditable diff.
6. Referrer-Policy `no-referrer` app-wide so view coordinates in the URL never leak via outbound
   links; outbound links additionally get `rel="noopener noreferrer"`.
7. Supply chain: minimal runtime deps (ADR-002), committed lockfile, Dependabot + `npm audit` CI
   gate, GitHub Actions pinned by commit SHA (issues 04, 45).

## Consequences

- No shortlink UX (`maps.app.goo.gl`) — mitigated by paste-fallback guidance (issue 36). Accepted trade.
- No telemetry means bug reports are user-initiated only — acceptable for v1 OSS.
- CSP via `<meta>` (Pages limitation) cannot express `frame-ancestors`; residual clickjacking risk
  documented and revisited if hosting changes (issue 43 acceptance criteria).
