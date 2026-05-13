# Commit Dock

**Commit Dock** is a [Visual Studio Code](https://code.visualstudio.com/) and **Cursor** extension that brings an IntelliJ-style commit workflow into the editor: one consistent **webview** for changed files, commit message, amend, stash, and safe push options.

> **Status:** see [GitHub Releases](https://github.com/vedanthvdev/commit-dock/releases) for the current VSIX. [CHANGELOG.md](CHANGELOG.md) tracks changes.

## Requirements

- VS Code **≥ 1.85** (or **Cursor** with a compatible VS Code engine — same **F5** Extension Development Host flow).

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `commitDock.snapshotDebounceMs` | `150` | Wait after Git reports a change before rebuilding the file list (0–2000 ms). |
| `commitDock.confirmBeforeDiscard` | `true` | If `false`, **Discard** runs immediately without a confirmation dialog. |

Configure under **Settings → Extensions → Commit Dock**, or edit `settings.json`.

## Commands and keybindings

All commands appear under the **Commit Dock** category in the Command Palette (**Ctrl+Shift+P** / **Cmd+Shift+P**).

| Command id | Title |
| --- | --- |
| `commitDock.showCommitView` | Focus Commit View |
| `commitDock.selectAll` | Select All Changes |
| `commitDock.deselectAll` | Deselect All Changes |
| `commitDock.stageSelected` | Stage Selected Changes |
| `commitDock.unstageSelected` | Unstage Selected Changes |
| `commitDock.discardSelected` | Discard Selected Changes |
| `commitDock.push` | Push |
| `commitDock.pushForceWithLease` | Push (Force With Lease) |

**Default shortcut:** **Ctrl+Shift+Alt+1** (Windows/Linux) or **Cmd+Shift+Alt+1** (macOS) focuses the Commit Dock view. Change it under **Keyboard Shortcuts** if it clashes with another extension.

## Limitations

- **One active repository** at a time: the extension picks a primary repo from the workspace (active editor or first folder), not a manual multi-repo switcher.
- **Webview workflow:** the file list and commit UI live in the **Commit** side bar view, not the built-in **Source Control** tree. Git state still comes from **`vscode.git`**.
- **Stash list** runs `git stash list` with the `git` on your **`PATH`** for that folder; it is independent of VS Code’s bundled Git path.
- **Merge conflicts** must be resolved with your usual tools; Commit Dock surfaces conflicted paths and blocks commit/push while conflicts exist.

## Security notes

- **Webview messages** are validated in the extension host (`parseWebviewMessage`): unknown types, wrong `protocolVersion`, oversized commit bodies, oversized paths, and absurd stash indices are rejected before touching Git.
- **Stash listing** runs `git` via `execFile` with a **fixed argument list** (no shell), `shell: false`, and only after the repo root is checked to be a **normal directory** on disk. Output is capped to avoid pathological lists.
- **Trust:** treat this extension like other Git UI: it can **stage, commit, push, discard, and stash** in folders you open. Use only in workspaces you trust.
- **Dependencies:** run `npm audit` periodically; CI uses **`npm ci`** for reproducible installs.

## Development

The default Git branch for this repository is **`master`**.

```bash
git checkout master
npm ci
npm run compile   # or npm run watch
npm run typecheck # strict TypeScript (no emit)
npm run lint
npm run package   # produces .vsix
```

Press **F5** in VS Code or Cursor to launch the **Extension Development Host**. Open the **Commit Dock** icon in the activity bar and run through stage, commit, push, and stash against a sample repo.

CI runs on **pushes to `master`** and on **pull requests targeting `master`**.

## Releasing

Releases are **SemVer tags** `vX.Y.Z` that match **`package.json` `version`**.

### Automatic (label-driven)

1. Open a PR targeting **`master`** with your code changes. **Do not** hand-edit `package.json` `version` unless you intentionally want to skip the label bump (see below).
2. Add **exactly one** SemVer intent label (create them once under **Issues → Labels** if needed):
   - **`semver:patch`** — bug fixes / small changes (0.9.6 → 0.9.7)
   - **`semver:minor`** — backwards-compatible features (0.9.6 → 0.10.0)
   - **`semver:major`** — breaking changes (0.9.6 → 1.0.0)
3. Optionally add **`skip-semver`** instead **only** for merges that must **not** produce a new marketplace version (docs-only, internal CI, etc.). Do not combine with `semver:*`.
4. The check **[SemVer label (PR to master)](.github/workflows/semver-label-required.yml)** must pass before merge (adds a green required status once you enable branch protection for it).
5. **Merge** the PR. [`.github/workflows/version-bump-on-pr-merge.yml`](.github/workflows/version-bump-on-pr-merge.yml) bumps **`npm version`**, prepends **[CHANGELOG.md](CHANGELOG.md)**, and **pushes one commit** to `master` (unless the PR already changed `package.json` `version`, or you used **`skip-semver`**).
6. That push runs [`.github/workflows/auto-tag-on-master.yml`](.github/workflows/auto-tag-on-master.yml), which tags **`v{version}`** and **dispatches** [`.github/workflows/release.yml`](.github/workflows/release.yml).
7. **Release** builds the VSIX, updates the **GitHub Release**, and runs **`vsce publish`** when **`VSCE_PAT`** is set.

**One-time labels (CLI):**

```bash
gh label create "semver:patch"  --color "0E8A16" --description "Release: patch bump after merge"
gh label create "semver:minor"  --color "FBCA04" --description "Release: minor bump after merge"
gh label create "semver:major"  --color "B60205" --description "Release: major bump after merge"
gh label create "skip-semver"    --color "C5DEF5" --description "Merge without version bump or release"
```

**Repository settings:** **Settings → Actions → General → Workflow permissions** → **Read and write** so Actions can push the bump commit, tags, and dispatch **Release** when using `GITHUB_TOKEN`.

**`TAG_PUSH_TOKEN` (recommended):** classic PAT with **`repo`**, or a fine-grained PAT with **Contents: Read and write** and **Actions: Read and write**. Used for tag `git push`, `gh workflow run Release`, and (in the version-bump workflow) pushing the bump commit if `GITHUB_TOKEN` is blocked by branch protection.

### Manual release for an existing tag

1. Open **Actions** → **Release** → **Run workflow**.
2. Enter the tag (e.g. **`v0.9.5`**) that already exists on GitHub.
3. The workflow checks out that tag, builds the VSIX, and creates or updates the release.

### Manual tag (optional)

You can still tag locally: `git tag vX.Y.Z && git push origin vX.Y.Z` after the version bump is on `master`. That **tag push** may start **Release** on its own; if it does not, run **Release** manually for that tag.

### Marketplace secret

Add **`VSCE_PAT`** (Visual Studio Marketplace PAT with **Marketplace (Manage)** scope) if you want **`vsce publish`**. Without it, the **GitHub Release** is still created.

**If older tags never created a Release**, use **Run workflow** on **Release** for that tag, or merge another PR with the appropriate **`semver:*`** label so automation runs again.

## Versioning

Versions follow **SemVer** (`MAJOR.MINOR.PATCH`). **Releases:** add **`semver:patch`**, **`semver:minor`**, or **`semver:major`** on PRs to **`master`** (or **`skip-semver`** when no release should ship); [CHANGELOG.md](CHANGELOG.md) gets an auto-prepended section for each release. Git branches for work items use **`COMMITDOCK-XXXX`** (one branch, one commit before merge to **`master`**, amended if iterating on the same branch).

## Repository

- [github.com/vedanthvdev/commit-dock](https://github.com/vedanthvdev/commit-dock)

## License

MIT — see [LICENSE](LICENSE).
