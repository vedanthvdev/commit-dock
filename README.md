# Commit Dock

**Commit Dock** is a [Visual Studio Code](https://code.visualstudio.com/) and **Cursor** extension that brings an IntelliJ-style commit workflow into the editor: one consistent **webview** for changed files, commit message, amend, stash, and safe push options.

> **Status:** current release is **`v0.9.3`** (auto-tag on `master` when `package.json` version changes). See [CHANGELOG.md](CHANGELOG.md).

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

### Automatic (recommended)

1. On a PR to **`master`**, bump **`package.json` `version`** and update **`CHANGELOG.md`** (and anything else for that release).
2. **Merge** the PR. If the version string **changed** compared to the previous commit on `master`, [`.github/workflows/auto-tag-on-master.yml`](.github/workflows/auto-tag-on-master.yml) creates and pushes **`v{version}`** on the merge commit.
3. That **tag push** runs [`.github/workflows/release.yml`](.github/workflows/release.yml): compile, typecheck, lint, package, **GitHub Release** with the VSIX, then **Marketplace** publish when **`VSCE_PAT`** is set.

If you merge **without** changing `version`, **no tag** is created and **no new release** runs (by design).

**Repository settings:** under **Settings → Actions → General → Workflow permissions**, use **Read and write permissions** (or a PAT with `contents: write`) so the auto-tag job can **push tags**. If pushes are blocked, the “Auto-tag version on master” workflow will fail at `git push`.

### Manual tag (optional)

You can still tag locally: `git tag vX.Y.Z && git push origin vX.Y.Z` after the version bump is on `master`.

### Marketplace secret

Add **`VSCE_PAT`** (Visual Studio Marketplace PAT with **Marketplace (Manage)** scope) if you want **`vsce publish`**. Without it, the **GitHub Release** is still created.

**If older tags never created a Release**, merge fixes, bump version once, merge — or create a release manually and upload a VSIX from `npm run package` locally.

## Versioning

Versions follow **SemVer** (`MAJOR.MINOR.PATCH`). Changes are recorded in [CHANGELOG.md](CHANGELOG.md). Git branches for work items use the pattern **`COMMITDOCK-XXXX`** (one branch, one commit before merge to **`master`**, amended if iterating on the same branch).

## Repository

- [github.com/vedanthvdev/commit-dock](https://github.com/vedanthvdev/commit-dock)

## License

MIT — see [LICENSE](LICENSE).
