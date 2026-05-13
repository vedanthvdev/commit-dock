# Commit Dock

**Commit Dock** is a [Visual Studio Code](https://code.visualstudio.com/) and **Cursor** extension that brings an IntelliJ-style commit workflow into the editor: one consistent **webview** for changed files, commit message, amend, stash, and safe push options.

> **Status:** current release is **`v0.9.0`** (Phase 8: settings, command palette category, default keybinding, README limitations). See [CHANGELOG.md](CHANGELOG.md).

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

## Development

The default Git branch for this repository is **`master`**.

```bash
git checkout master
npm install
npm run compile   # or npm run watch
npm run package   # produces .vsce / vsce package
```

Press **F5** in VS Code or Cursor to launch the **Extension Development Host**. Open the **Commit Dock** icon in the activity bar and run through stage, commit, push, and stash against a sample repo.

CI runs on **pushes to `master`** and on **pull requests targeting `master`**.

## Releasing

1. Bump **`package.json` `version`** and **`CHANGELOG.md`** on `master`, merge, then tag **`vX.Y.Z`** on that commit (the tag must match the version string).
2. Add repository secret **`VSCE_PAT`** (Visual Studio Marketplace PAT with **Marketplace (Manage)** scope).
3. Pushing the tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml): compile, lint, **`vsce publish`**, and a **GitHub Release** with the VSIX.

## Versioning

Versions follow **SemVer** (`MAJOR.MINOR.PATCH`). Changes are recorded in [CHANGELOG.md](CHANGELOG.md). Git branches for work items use the pattern **`COMMITDOCK-XXXX`** (one branch, one commit before merge to **`master`**, amended if iterating on the same branch).

## Repository

- [github.com/vedanthvdev/commit-dock](https://github.com/vedanthvdev/commit-dock)

## License

MIT — see [LICENSE](LICENSE).
