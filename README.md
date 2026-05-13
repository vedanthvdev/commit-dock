# Commit Dock

**Commit Dock** is a [Visual Studio Code](https://code.visualstudio.com/) and **Cursor** extension that brings an IntelliJ-style commit workflow into the editor: one consistent **webview** for changed files, commit message, amend, stash, and safe push options.

> **Status:** current release is **`v0.9.2`** (hardening, CI typecheck, dependency refresh). See [CHANGELOG.md](CHANGELOG.md).

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

1. Bump **`package.json` `version`** and **`CHANGELOG.md`** on `master`, merge, then create an annotated or lightweight tag **`vX.Y.Z`** on that commit. The tag **must** match the version string (for example tag **`v0.9.1`** for version **`0.9.1`**).
2. Push the tag: `git push origin vX.Y.Z`. [`.github/workflows/release.yml`](.github/workflows/release.yml) runs on that tag push.
3. **GitHub Release:** the workflow **always** builds the VSIX and **creates or updates** a [GitHub Release](https://github.com/vedanthvdev/commit-dock/releases) for that tag, attaching the `.vsix` (using the default **`GITHUB_TOKEN`**). You do **not** need **`VSCE_PAT`** for the Release to appear.
4. **Visual Studio Marketplace (optional):** add repository secret **`VSCE_PAT`** (PAT with **Marketplace (Manage)** scope). If it is missing, the workflow **skips** `vsce publish` with a notice and still completes successfully so the GitHub Release is not blocked.

**If older tags never created a Release** (for example the workflow used to fail before `gh release create` when `VSCE_PAT` was unset), merge the fix, bump version, push a new tag, or create a release manually from **Releases → Draft a new release** and upload the VSIX from `npm run package` locally.

## Versioning

Versions follow **SemVer** (`MAJOR.MINOR.PATCH`). Changes are recorded in [CHANGELOG.md](CHANGELOG.md). Git branches for work items use the pattern **`COMMITDOCK-XXXX`** (one branch, one commit before merge to **`master`**, amended if iterating on the same branch).

## Repository

- [github.com/vedanthvdev/commit-dock](https://github.com/vedanthvdev/commit-dock)

## License

MIT — see [LICENSE](LICENSE).
