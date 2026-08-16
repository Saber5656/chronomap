# Contributing to Chronomap

Thank you for contributing. Open a focused pull request against `main`, explain
the user-visible or maintenance impact, and keep unrelated changes separate.
Before requesting review, run the repository's lint, format, typecheck, test, and
build checks. Never commit credentials, tokens, private data, or generated local
configuration.

## Adding a dependency

- Justify the dependency and the alternatives considered in the pull request.
- Obtain maintainer approval before adding any runtime dependency.
- For a dependency that can make network requests, review the host allowlist in
  `src/security/hosts.ts` and the Content Security Policy before approval. If the
  allowlist file is not present yet, document the required host policy in the pull
  request rather than silently broadening network access.
- Commit `package-lock.json` whenever dependency metadata changes.
- Keep CI installs reproducible with `npm ci`; do not replace them with
  `npm install`.
