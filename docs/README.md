# Documentation map

`DESIGN.md` is the product design source of truth; `ISSUE_PLAN.md` maps design sections to stable issue IDs; `issues/` contains the implementation specifications.

`decisions/` records accepted architectural and policy decisions; `research/` records provider and platform evidence; `integrations/` contains user-facing integration recipes when those dependencies are present.

Implementation work follows the issue document in an issue-specific worktree, with focused tests and evidence recorded before review.

The post-v1 Expo Go demo is specified by [issue 49](issues/49-expo-go-mobile-demo.md) and
[ADR-007](decisions/ADR-007-expo-go-mobile-demo.md); device instructions live in
[`apps/mobile/README.md`](../apps/mobile/README.md).

If an unknown exceeds the current issue's scope, create a new `docs/issues/NN-*.md` through review as required by `ISSUE_PLAN.md` §7; do not widen the existing issue silently.
