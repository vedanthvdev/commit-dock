## SemVer (PRs to `master`)

- [ ] **Exactly one** of: `semver:patch` · `semver:minor` · `semver:major`  
      **or** `skip-semver` alone (no `semver:*`) when this merge must **not** ship a new extension version.
- [ ] **Do not** change `package.json` `version` in this PR for normal releases — that value on `master` is the **current extension version**; after merge, CI bumps it from **that number** using the label you picked (`patch` / `minor` / `major`).
- [ ] If you **don’t** see those labels in the label picker yet, run **Actions → Sync SemVer labels** once (or merge to `master` so [`.github/workflows/sync-semver-labels.yml`](.github/workflows/sync-semver-labels.yml) runs).

See [Releasing](README.md#releasing).

## What changed (optional)

<!-- Short note for reviewers / CHANGELOG context -->
