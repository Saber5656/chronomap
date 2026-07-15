# Title

Scaffold Vite + TypeScript (strict) project skeleton

## Summary

Create the buildable application skeleton: Vite vanilla-TS project, strict tsconfig, the DESIGN
§4.1 directory layout with placeholder modules, npm scripts, and repo hygiene files. No product
features.

## Context

The repository currently contains only `README.md` and `docs/`. Every other issue builds on this
skeleton; its layout must match DESIGN §4.1 exactly so later issues can reference stable paths.

## Scope

- `package.json` (name `chronomap`, `"private": true`, `"type": "module"`), committed
  `package-lock.json`, `.nvmrc` with current Node LTS major.
- Dependencies: `maplibre-gl@^5.24` (runtime); dev: `vite`, `typescript`. Nothing else (lint/test
  tooling arrives in issues 02/03).
- `index.html`: `<!doctype html>`, `lang="ja"`, viewport meta
  (`width=device-width, initial-scale=1, viewport-fit=cover`), `<div id="app">`, module script
  `src/main.ts`. No CSP yet (issue 43).
- `src/` skeleton per DESIGN §4.1: create directories `app/ state/ map/ providers/layers/
  providers/poi/ integrations/ security/ ui/components/ ui/styles/ ui/i18n/ util/` each with a
  placeholder `index.ts` or the named file exporting an empty stub + one-line doc comment pointing
  at its DESIGN section.
- `src/main.ts`: renders `<main>chronomap</main>` into `#app` (proves the pipeline; replaced by
  issue 08).
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes:
  true`, `verbatimModuleSyntax: true`, `target/lib ES2022 + DOM`, `moduleResolution: "bundler"`.
- Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`.
- `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.DS_Store`, `*.local`.

## Detailed Requirements

1. `npm ci && npm run build` must succeed on a clean checkout with the `.nvmrc` Node version.
2. Do not add any UI framework, CSS framework, or state library (ADR-002).
3. Placeholder stubs must compile under the strict flags above (no `any`, no `@ts-ignore`).
4. `vite.config.ts`: default config + `base: './'` placeholder comment noting issue 06 will set
   the final Pages base path.

## Acceptance Criteria

- [ ] Clean-checkout `npm ci`, `npm run build`, `npm run dev` all work; `dist/` renders the
      placeholder text when served via `npm run preview`.
- [ ] Directory tree matches DESIGN §4.1 (docs/ paths excluded).
- [ ] `package-lock.json` committed; only the dependencies listed above are present.
- [ ] tsconfig flags exactly as specified.

## Validation

Manual: run the three scripts. CI arrives in issue 04; this issue must leave the repo in a state
where issue 04's pipeline passes without modification to this issue's files.

## Dependencies

None (first issue).

## Non-goals

Lint/format (02), tests (03), CI (04), deploy config (06), real app shell (08), PWA (30/31).

## Design References

DESIGN §4.1, §4.2; ADR-002.
