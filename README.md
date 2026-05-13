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
| `commitDock.showActivityBarBadge` | `true` | When `true`, the Commit Dock activity bar icon shows how many paths have pending work in the **primary** repository (same scope as the Commit view). |
| `commitDock.showCommitAndPushButton` | `true` | When `false`, hides **Commit and Push** so commit and push stay two explicit steps. |
| `commitDock.externalMergeToolPath` | `""` | Optional path to your merge tool binary or macOS `.app` for **Open External Merge Tool for Conflict…** (see README). |

Configure under **Settings → Extensions → Commit Dock**, or edit `settings.json`.

## Commands and keybindings

All commands appear under the **Commit Dock** category in the Command Palette (**Ctrl+Shift+P** / **Cmd+Shift+P**).

| Command id | Title |
| --- | --- |
| `commitDock.showCommitView` | Focus Commit View |
| `commitDock.checkoutLocalBranch` | Checkout Local Branch… |
| `commitDock.createBranchFromHead` | Create Branch from HEAD… |
| `commitDock.copyHeadRevision` | Copy HEAD revision (full SHA) to the clipboard |
| `commitDock.openExternalMergeTool` | Open External Merge Tool for Conflict… |
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
- **External merge tool:** when configured, **Open External Merge Tool for Conflict…** starts your tool with a **single** conflict file path argument via `spawn` (no shell, no interpolated command strings). Point the setting at a binary you trust.
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

This flow follows the same **“exactly one `semver:*` label”** idea as [dayseam/dayseam](https://github.com/dayseam/dayseam): PRs declare release intent with labels; automation bumps and ships after merge.

**You do not put the next extension version in your feature PR.** The **current** extension SemVer always lives in **`package.json` `version` on `master`** (whatever was last released / last bumped). Your PR changes product code only; **GitHub labels on that PR** tell automation **how** to increment that existing number **after** the PR merges (or **`semver:none`** when there must be **no** bump or release train).

1. **Labels exist on the repo** so they show in the PR label picker: [`.github/workflows/sync-semver-labels.yml`](.github/workflows/sync-semver-labels.yml) runs on every **`push` to `master`** and on **Actions → Sync SemVer labels → Run workflow**. It creates/updates:
   - **`semver:patch`** — after merge → `npm version patch` (e.g. `0.9.6` → `0.9.7`) from **current** `package.json` on `master`
   - **`semver:minor`** — after merge → `npm version minor` (e.g. `0.9.6` → `0.10.0`)
   - **`semver:major`** — after merge → `npm version major` (e.g. `0.9.6` → `1.0.0`)
   - **`semver:none`** — merge **without** bumping `package.json` or shipping a new release (same role as Dayseam’s `semver:none`)
2. Open a PR targeting **`master`**. Add **exactly one** of **`semver:patch` \| `semver:minor` \| `semver:major` \| `semver:none`** (see [check-semver-label](.github/workflows/check-semver-label.yml)). The legacy **`skip-semver`** label is **not** accepted on new PRs — remove it and use **`semver:none`**.
3. **[check-semver-label](.github/workflows/check-semver-label.yml)** reads **only the labels on the PR** (not file contents) and must pass before merge if you mark it required in branch protection.
4. **Merge** the PR. **[Version bump on PR merge](.github/workflows/version-bump-on-pr-merge.yml)** runs on the merge event: it **waits for required CI check-runs** on the merge commit, then reads **`package.json` `version` on the merge commit** (and compares to the merge’s first parent), applies **`npm version patch|minor|major`** on **top of the current `master` tip** (so it never rewinds and drops newer commits), prepends **[CHANGELOG.md](CHANGELOG.md)**, and **pushes one commit** to `master`. It **skips** the bump for **`semver:none`** (and still accepts legacy **`skip-semver`** on already-merged replay events with a deprecation notice), if the merge itself already changed `package.json` `version`, if **`master` already matches the expected next SemVer** (re-runs / duplicate events), or if **`master` is already ahead** of the merge baseline. (Skipped or not, it will not loop bumping the same merge forever.)
5. That push runs [`.github/workflows/auto-tag-on-master.yml`](.github/workflows/auto-tag-on-master.yml), which tags **`v{version}`** and **dispatches** [`.github/workflows/release.yml`](.github/workflows/release.yml).
6. **Release** builds the VSIX, updates the **GitHub Release**, and runs **`vsce publish`** when **`VSCE_PAT`** is set.

**Optional (local CLI):** you can still run `gh label create …` if you prefer; the sync workflow makes that unnecessary.

**Repository settings:** **Settings → Actions → General → Workflow permissions** → **Read and write** so Actions can push the bump commit, tags, and dispatch **Release** when using `GITHUB_TOKEN`.

**`TAG_PUSH_TOKEN` (recommended):** classic PAT with **`repo`**, or a fine-grained PAT with **Contents: Read and write** and **Actions: Read and write**. Used for tag `git push`, `gh workflow run Release`, and (in the version-bump workflow) pushing the bump commit if `GITHUB_TOKEN` is blocked by branch protection.

### Manual release for an existing tag

1. Open **Actions** → **Release** → **Run workflow**.
2. Enter the tag (e.g. **`v0.9.5`**) that already exists on GitHub.
3. The workflow checks out that tag, builds the VSIX, and creates or updates the release.

### Manual tag (optional)

You can still tag locally: `git tag vX.Y.Z && git push origin vX.Y.Z` after the version bump is on `master`. That **tag push** may start **Release** on its own; if it does not, run **Release** manually for that tag.

### VS Code Marketplace

The **Release** workflow runs **`vsce publish`** only when the repository secret **`VSCE_PAT`** is set. If that secret is missing, the run still builds the VSIX and updates the **GitHub Release**, but you will see a notice that Marketplace publish was skipped (this is what happened for **`v0.9.6`** until `VSCE_PAT` exists).

1. **Publisher** — `package.json` **`"publisher"`** must match your Marketplace publisher id **exactly** (case-sensitive), including in the manage URL path. This repo uses **`VedanthVasuDev`** ([publisher manage page](https://marketplace.visualstudio.com/manage/publishers/VedanthVasuDev)). If you have not created a publisher yet, use [Manage publishers & extensions](https://marketplace.visualstudio.com/manage) → **Create publisher**.

**Public web URL (`/items?itemName=…`)** — Microsoft’s Marketplace site sometimes returns **“404 – Page not found”** for a valid extension while the CLI still resolves it (`npx vsce show VedanthVasuDev.commit-dock`). That does **not** mean the upload failed. Prefer the links below for sharing and installs.

- **Open in VS Code / Cursor:** `vscode:extension/VedanthVasuDev.commit-dock` (paste into the browser address bar, or use **Open URL** from the Command Palette inside the editor).
- **From the Extensions view:** paste **`@id:VedanthVasuDev.commit-dock`** in the search box, then install.
- **Canonical item URL (may still 404 in a browser):** `https://marketplace.visualstudio.com/items?itemName=VedanthVasuDev.commit-dock`
- **Publisher hub (sign in):** [extension hub](https://marketplace.visualstudio.com/manage/publishers/VedanthVasuDev/extensions/commit-dock/hub) — use the same Microsoft account as your Marketplace PAT.
2. **Personal access token** — Create a PAT with scope **Marketplace → Manage** (Azure DevOps). Official steps: [Get a Personal Access Token](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token).
3. **GitHub secret** — In this repo: **Settings → Secrets and variables → Actions → New repository secret** → name **`VSCE_PAT`**, value = the PAT.
4. **Publish** — **Actions → Release → Run workflow** and set **tag** to a tag whose `package.json` already has the right **`publisher`** (the workflow checks out that tag). Use the **latest** `v*` tag on `master` (for example **`v0.9.7`**), not an older tag whose `package.json` is stale.

**Publish from your machine** (same PAT in the environment):

```bash
export VSCE_PAT="***"   # Marketplace (Manage) token
npm ci && npm run publish:marketplace
```

That runs `vscode:prepublish` (production build) then `vsce publish` for the version in `package.json`.

**If older tags never hit the Marketplace**, run **Release** manually for that tag after `VSCE_PAT` is configured, or ship a new version from `master` with the normal **`semver:*`** merge flow.

## Versioning

Versions follow **SemVer** (`MAJOR.MINOR.PATCH`). **Releases:** add **`semver:patch`**, **`semver:minor`**, or **`semver:major`** on PRs to **`master`**, or **`semver:none`** when no release should ship; [CHANGELOG.md](CHANGELOG.md) gets an auto-prepended section for each release. Git branches for work items use **`COMMITDOCK-XXXX`** (one branch, one commit before merge to **`master`**, amended if iterating on the same branch).

## Repository

- [github.com/vedanthvdev/commit-dock](https://github.com/vedanthvdev/commit-dock)

## License

MIT — see [LICENSE](LICENSE).
