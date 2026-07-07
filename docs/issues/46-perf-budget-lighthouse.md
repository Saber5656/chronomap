# Title

Enforce performance budgets with Lighthouse CI

## Summary

Add Lighthouse CI (mobile profile) against the built app with the §14 budgets as assertions, plus
bundle-size tracking, and fix any budget violations found.

## Context

DESIGN §14. MapLibre is heavy; without an enforced budget the app drifts past mobile usability.
This lands late (after all features) to measure the real v1.

## Scope

- Dev dep `@lhci/cli`; `lighthouserc.json`: `collect` against `npm run preview` URL (built app,
  SW active), settings: mobile emulation, simulated 4G; `assert` category scores:
  performance ≥ 90, pwa: all installable audits pass, accessibility ≥ 90 (41 made it true),
  best-practices ≥ 95; budgets: script ≤ 350 KB gzip, stylesheet ≤ 40 KB, total ≤ 600 KB
  (excluding stubbed tiles — LHCI hits real page: ensure tile hosts unreachable→graceful? No:
  run LHCI with `--collect.settings.blockedUrlPatterns` for tile/API hosts so runs are hermetic
  and §13 offline states render — document that performance is measured on the shell).
- CI: separate workflow job `lighthouse` in ci.yml on PRs (needs build artifact; non-flaky config:
  3 runs, median); `continue-on-error: false`.
- Bundle report: `vite build` rollup output sizes echoed + compared in the job log; hard gate via
  LHCI budgets only (single source of truth).
- Fix violations found (likely: code-split About/onboarding via dynamic import — 42 already lazy;
  verify; MapLibre is the floor — document actual numbers in PR).

## Detailed Requirements

1. Hermetic runs: no real upstream requests (blocked patterns); document that field performance
   with tiles is tracked manually at release (48's device matrix).
2. Budgets live in lighthouserc.json only (no duplicated constants).
3. Flake policy: median-of-3; if perf score flakes ±3 around 90 in CI hardware, set 87 with a
   dated TODO to restore 90 — decision recorded in the PR (conservative, explicit).

## Acceptance Criteria

- [ ] LHCI job green on PR with the assertions above; numbers table (score, LCP, TBT, transfer)
      pasted in PR.
- [ ] Budget regression demo: adding a 500 KB dummy import fails the job (demonstrated, not
      committed).
- [ ] PWA category: installability audits all pass (30/31 verified end-to-end here).

## Validation

CI job on the PR; local `npx lhci autorun` documented in CONTRIBUTING (45's file — append).

## Dependencies

06 (build/base), 31 (SW), 41 (a11y score), most features merged (measures reality).

## Non-goals

Real-network field metrics (manual at 48), RUM/analytics (never), image optimization pipeline
(icons are already tiny).

## Design References

DESIGN §14, §15, §16.
