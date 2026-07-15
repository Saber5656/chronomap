# Title

Add Content Security Policy and security meta tags (with MapLibre compatibility verification)

## Summary

Add the §12.4 meta CSP (allowlisting exactly the provider hosts), referrer policy, and resolve the
MapLibre-under-CSP unknowns (worker/blob, style injection) with a documented final policy.

## Context

DESIGN §12.4; ADR-005 rule 5 (egress allowlist as auditable diff). GitHub Pages cannot set
headers, so `<meta http-equiv>` CSP is the enforcement point; its limitations must be documented,
not discovered.

## Scope

- `index.html`: add `<meta http-equiv="Content-Security-Policy" content="…">` starting from the
  §12.4 policy verbatim, and `<meta name="referrer" content="no-referrer">`.
- Verification matrix (the core work — record results in the PR and as code comments):
  1. MapLibre GL worker: does it require `worker-src blob:` and the older-engine fallback
     `child-src blob:`? (bundler-dependent). If yes, add `worker-src 'self' blob:` plus
     `child-src blob:` — narrowest form.
  2. MapLibre runtime `<style>` injection or inline style attributes needing `style-src`
     relaxation: test built app with policy active; prefer extracting to static CSS; only if
     impossible, add the narrowest relaxation with written justification.
  3. GL context / image decode paths (`img-src` needs `data:`/`blob:`? keep only what breaks).
  4. vite-plugin-pwa registration script inline? → ensure external file (config), no
     `'unsafe-inline'` for scripts under any circumstance.
- Host lists: generate the `img-src`/`connect-src` host sets from `src/security/hosts.ts` (24) at
  build time (small vite plugin or a build script asserting index.html matches hosts.ts — pick
  the simpler: a unit test string-comparing the meta against a canonical policy builder function).
  The default v1 policy excludes Konjaku hosts when the Konjaku feature flag is OFF; a Konjaku-enabled
  build path appends `https://ktgis.net` to `img-src` using the same flag gate as the registry.
- Document (docs/decisions/ADR-005 amendment or `src/security/README.md`): final policy, what
  meta-CSP cannot do (`frame-ancestors`, report-uri), and the rule "new provider host ⇒ update
  hosts.ts ⇒ policy test fails until meta updated".

## Detailed Requirements

1. The final policy must block: inline script injection, cross-origin fetch to non-allowlisted
   hosts, form posts, object/embed, base tag hijack (e2e-verified below).
2. Konjaku host `ktgis.net` is absent from the default policy while the flag is OFF, and present only
   in the Konjaku-enabled policy/build path.
3. No `unsafe-eval`; if MapLibre requires it (it should not in v5), STOP and escalate via a new
   issue rather than adding it.

## Acceptance Criteria

- [ ] e2e `tests/e2e/csp.spec.ts`: app fully functional (map, slider, POI, sheets) with zero
      `securitypolicyviolation` events (listener installed; assert none) across the main journeys.
- [ ] e2e negative: injected `<img src="https://evil.example/x.png">` and `fetch('https://evil.example')`
      from console context produce violation events / rejections (blocked).
- [ ] Unit: policy-builder test pins meta content to hosts.ts (drift fails).
- [ ] Unit: default policy excludes `ktgis.net`; Konjaku-enabled policy includes it.
- [ ] PR contains the 4-point verification matrix with outcomes.

## Validation

CSP e2e suite + manual DevTools check on the deployed preview.

## Dependencies

10, 25, 31 (the features the policy must not break), 24 (hosts.ts).

## Non-goals

Server headers (impossible on Pages — revisit on hosting change), SRI for self-hosted hashed
assets (redundant), Trusted Types (v2 evaluation).

## Design References

DESIGN §12.4, §12.2 A1/A4/A7/A8; ADR-001, ADR-005.
