# Title

Add GitHub Pages deploy workflow with SPA fallback and correct base path

## Summary

Deploy `dist/` to GitHub Pages from main via Actions, with `404.html` SPA fallback (required by
the `/share` route) and Vite `base` set for project pages.

## Context

DESIGN §16 (deploy) and §9.3 (the `/share` route must resolve on Pages). Hosting is GitHub Pages
per ADR-001; the app lives at `https://saber5656.github.io/chronomap/`.

## Scope

- `vite.config.ts`: `base: '/chronomap/'` (replace issue-01 placeholder). All internal URLs must
  be base-relative (`import.meta.env.BASE_URL`); grep for hardcoded `/` paths in `src/` and fix.
- `.github/workflows/deploy.yml`: trigger `push: branches [main]` (+ `workflow_dispatch`);
  job 1 reuses the verify steps (or `needs` a called workflow) — deploy only on green; job 2:
  build → copy `dist/index.html` → `dist/404.html` → `actions/upload-pages-artifact` →
  `actions/deploy-pages` with `permissions: { pages: write, id-token: write, contents: read }`,
  `environment: github-pages`. Actions SHA-pinned (issue 04 convention).
- Document in workflow comments: Pages must be set to "GitHub Actions" source once, manually, by
  the owner (repo Settings → Pages) — record this as a human step in the PR description.

## Detailed Requirements

1. Deep links like `/chronomap/?lat=35.68&lng=139.76` and `/chronomap/share?text=…` must load the
   app (via real path or 404 fallback), not a GitHub 404.
2. No secrets beyond default `GITHUB_TOKEN`; deploy must not run on PRs or forks.
3. The workflow must be a no-op failure-free if Pages is not yet enabled (documented behavior is
   acceptable: the deploy step fails with a clear message — state which in the PR).

## Acceptance Criteria

- [ ] After owner enables Pages and merges: site reachable at the project URL; `/share?text=x`
      URL loads the app shell.
- [ ] `curl -sI https://saber5656.github.io/chronomap/ | head -1` → 200.
- [ ] Deploy skipped/absent on PR events.

## Validation

Post-merge manual check of the three acceptance URLs; CI logs show artifact upload + deployment.

## Dependencies

04 (CI verify steps). Human step: owner enables Pages source = Actions.

## Non-goals

Custom domain, response headers (impossible on Pages — see ADR-001/issue 43), PWA scope tuning (30).

## Design References

DESIGN §16, §9.3; ADR-001.
