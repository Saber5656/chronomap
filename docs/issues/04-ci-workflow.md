# Title

Add hardened CI workflow (verify: lint → typecheck → test → build → audit)

## Summary

Create `.github/workflows/ci.yml` running the full verify pipeline on PRs and main pushes, with
SHA-pinned actions, minimal permissions, and an `npm audit` gate.

## Context

DESIGN §16 defines the pipeline; §12.5 requires supply-chain hardening from the first workflow —
retro-hardening later is error-prone.

## Scope

- `.github/workflows/ci.yml`:
  - Triggers: `pull_request`, `push: branches [main]`.
  - Top-level `permissions: { contents: read }`; `concurrency` group per ref with
    `cancel-in-progress: true`.
  - Single job `verify` on `ubuntu-latest`: checkout → setup-node (version from `.nvmrc`,
    `cache: npm`) → `npm ci` → `npm run validate:registry --if-present` → `npm run lint` →
    `npm run typecheck` → `npm run test` → `npm run build` →
    `npm audit --omit=dev --audit-level=high`.
  - Separate non-blocking step `npm audit --audit-level=high || true` for devDeps visibility
    (`continue-on-error: true`).
- Add `typecheck` script (`tsc --noEmit`) to package.json.
- **All** `uses:` actions pinned to full 40-char commit SHAs with trailing version comment, e.g.
  `actions/checkout@<sha> # v4`.

## Detailed Requirements

1. Workflow must pass on the current repo state (issues 01–03 merged).
2. No secrets consumed; no `pull_request_target`; no third-party actions beyond
   `actions/checkout` and `actions/setup-node`.
3. `validate:registry` uses `--if-present` so the workflow is stable before issue 14 adds it.

## Acceptance Criteria

- [ ] CI green on a PR touching a source file; red when lint, a test, or the prod-deps audit gate
      fails (demonstrate audit path reasoning in PR description; no need to force a real failure).
- [ ] `gh api repos/{owner}/{repo}/actions/permissions` unchanged (no new repo settings assumed).
- [ ] Every action reference is a full SHA.

## Validation

Open the PR, observe the `verify` job matrix of steps all green; re-run after intentionally
breaking `lint` in a fixup commit, observe red, then drop the fixup.

## Dependencies

02 (lint), 03 (test) — their scripts are invoked here.

## Non-goals

Deploy (06), e2e in CI (07 adds its step to this workflow), Dependabot/SECURITY.md (45),
Lighthouse (46).

## Design References

DESIGN §16, §12.5; ADR-005.
