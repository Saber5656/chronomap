# Title

Enforce supply-chain policy: Dependabot, audit gates, action pinning audit, SECURITY.md

## Summary

Complete the §12.5 supply-chain posture: Dependabot config, dependency-review gate on PRs, a
pinned-actions audit test, SECURITY.md with private reporting, and a documented dependency-
addition rule.

## Context

ADR-005 rule 7. Issues 04/06 established pinning and audit steps; this issue systematizes them
and adds the human-facing security process files required for a public OSS repo.

## Scope

- `.github/dependabot.yml`: ecosystems `npm` (weekly, grouped minor/patch) and `github-actions`
  (weekly); labels `dependencies`.
- `ci.yml`: add `actions/dependency-review-action` job on `pull_request` (SHA-pinned,
  `fail-on-severity: high`).
- `scripts/check-action-pinning.mjs` + unit test: parse `.github/workflows/*.yml`; every `uses:`
  matches `owner/repo@[0-9a-f]{40}`; wired as `npm run check:pins` inside CI verify.
- `SECURITY.md`: supported versions (latest deploy only), private reporting via GitHub Security
  Advisories ("Report a vulnerability"), response target (best-effort 14 days, solo maintainer),
  scope notes (client-only app; upstream provider issues out of scope).
- `CONTRIBUTING.md`: short section "Adding a dependency": justify in PR, runtime deps require
  maintainer approval + hosts.ts/CSP review if network-touching; lockfile always committed;
  `npm ci` only in CI.
- Enable-repo-settings checklist for the owner (PR description, human steps): Dependabot alerts,
  secret scanning + push protection, private vulnerability reporting toggle.

## Detailed Requirements

1. No new runtime dependencies added by this issue itself.
2. Pinning checker must catch `@v4`, `@main`, and short-SHA forms (test fixtures).
3. Dependency-review job must not block forks' first-time contributors incorrectly (default
   behavior fine; document).

## Acceptance Criteria

- [ ] `npm run check:pins` green; seeding a `@v4` ref in a fixture workflow fails the unit test.
- [ ] Dependabot config valid (GitHub UI shows both ecosystems after merge).
- [ ] Dependency-review job appears and passes on this PR itself.
- [ ] SECURITY.md + CONTRIBUTING.md sections merged; owner checklist posted in PR.

## Validation

CI on the PR + post-merge GitHub UI verification (owner confirms the three settings toggles).

## Dependencies

04 (workflows exist). Human steps: repo settings toggles (owner).

## Non-goals

SBOM generation (v2 if requested), npm provenance (app, not a published package), CodeQL (optional
follow-up — note as candidate in ISSUE_PLAN unknowns if wanted).

## Design References

DESIGN §12.5, §16; ADR-005 rule 7; §12.2 A9.
