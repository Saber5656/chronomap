# Title

Add ESLint (flat config) + Prettier with security-relevant lint rules

## Summary

Introduce linting/formatting with rules that mechanically enforce this project's security
conventions (no `innerHTML`-family sinks, no `eval`), plus npm scripts used by CI.

## Context

ADR-002/ADR-005 rely on "external strings via `textContent` only". A lint rule makes that rule
enforceable rather than aspirational, so weaker implementation agents cannot regress it silently.

## Scope

- Dev deps: `eslint`, `typescript-eslint`, `eslint-config-prettier`, `prettier`.
- `eslint.config.js` (flat): `typescript-eslint` recommended-type-checked on `src/**` and
  `tests/**`; plus:
  - `no-restricted-properties`: forbid `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
    `document.write` (error, message pointing to DESIGN §12.3).
  - `no-restricted-globals`/syntax: forbid `eval`, `new Function`.
  - `@typescript-eslint/no-explicit-any: error`, `no-console: ["warn", { allow: ["warn","error"] }]`.
- `.prettierrc.json` (defaults + `printWidth: 100`), `.prettierignore` (`dist`, `docs`),
  `.editorconfig` (2-space, LF, final newline).
- Scripts: `lint` (`eslint .`), `format` (`prettier --write .`), `format:check`.

## Detailed Requirements

1. `npm run lint` and `npm run format:check` pass on the issue-01 skeleton after formatting it.
2. Rules must be errors (not warnings) for the restricted sinks; add one negative test: a scratch
   file using `innerHTML` must fail lint (demonstrate in PR description, do not commit it).
3. Do not disable type-aware linting for `src/`.

## Acceptance Criteria

- [ ] `npm run lint` exits 0 on the repo; introducing `el.innerHTML = x` anywhere in `src/` makes
      it exit non-zero.
- [ ] `npm run format:check` exits 0; whole repo formatted once in this PR.
- [ ] Config files exactly at the paths above; no per-file `eslint-disable` in committed code.

## Validation

Run both scripts locally; issue 04 wires them into CI unchanged.

## Dependencies

01 (scaffold).

## Non-goals

Test tooling (03), CI (04), pre-commit hooks (not used in v1).

## Design References

DESIGN §12.3, §12.5, §16; ADR-002, ADR-005.
