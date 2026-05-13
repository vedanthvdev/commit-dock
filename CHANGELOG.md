# Changelog

All notable changes to **Commit Dock** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- GitHub **default branch** is now **`master`** (was `main`). CI runs on pushes and PRs targeting `master`.

### Planned

- Phase 4: Commit message + plain commit (+ auto-stage selected).
- Phase 5: Amend + message defaulting from HEAD.
- Phase 6: Push + force-with-lease flow.
- Phase 7: Stash list + pop/apply/drop.
- Phase 8: Polish, settings, shortcuts.

## [0.4.0] - 2026-05-13

### Added

- **Phase 3 — Stage / unstage / discard:** host applies **`vscode.git`** `add`, `revert` (unstage), `clean` (untracked), and `restore` (working tree) for **selected** paths only; destructive discard uses a **modal confirmation**.
- **Webview toolbar:** Stage, Unstage, and Discard actions (protocol **v4**).
- **Commands:** `commitDock.stageSelected`, `commitDock.unstageSelected`, and `commitDock.discardSelected`.

## [0.3.0] - 2026-05-13

### Added

- **Phase 2 — Selection model:** host keeps a per-repo set of **deselected** paths; `repoSnapshot` includes `deselectedPaths` and each file includes `selected` (protocol **v3**).
- **Webview:** per-file checkboxes (staged / changes / untracked), group header checkboxes with tri-state (merge conflicts remain non-selectable), **Select all** / **Deselect all** toolbar, and **Cmd/Ctrl+A** to select all when the changes panel is focused.
- **Commands:** `commitDock.selectAll` and `commitDock.deselectAll` (palette + activation) mirroring the webview actions.

## [0.2.0] - 2026-05-13

### Added

- **Phase 1 — Repo snapshot in webview:** host builds a `repoSnapshot` from the primary Git repository (`vscode.git`) using `mergeChanges`, `indexChanges`, `workingTreeChanges`, and `untrackedChanges`.
- **Debounced refresh** (~150ms) on `repository.state.onDidChange`, plus updates on `repository.onDidCommit`, `onDidOpenRepository`, `onDidCloseRepository`, workspace folder changes, and active editor changes.
- **Webview UI:** collapsible groups (merge conflicts, staged, changes, untracked) with VS Code theme colors and codicons; `<details>` open/closed state persisted via `vscode.getState` / `setState`.
- **Protocol** bumped to **v2** for `repoSnapshot` messages.

## [0.1.1] - 2026-05-13

### Added

- GitHub Actions workflow to **compile** and **lint** on every push and pull request.

### Fixed

- **Git API bootstrap:** avoid hanging forever if `initialized` never fires; dispose `onDidChangeState` listener; add 15s timeout with user-facing warning when not in silent mode.
- **Webview refresh:** call `getGitApi({ silent: true })` when pushing status so missing/disabled Git does not spam notifications on every view visibility change.
- **Status copy:** distinguish “Git disabled / unavailable” vs “no repository open”.
- **Lifecycle:** dispose `onDidReceiveMessage` and `onDidChangeVisibility` when the webview is disposed; clear `_view` reference.
- **CSP nonce:** derive nonce from `crypto.randomBytes` instead of `Math.random`.
- **Protocol:** reject non-object and array payloads; require `type` to be a string before accepting `ready` / `noop`.
- **Manifest:** explicit `activationEvents` for the webview view and focus command; `vsce package` without deprecated `--no-dependencies` flag.

## [0.1.0] - 2026-05-13

### Added

- **Commit Dock** extension scaffold (`displayName`: Commit Dock, package name `commit-dock`).
- Activity bar container and **webview** commit view (`commitDock.commitView`) with strict CSP and per-load nonce.
- Dual **esbuild** pipeline: extension host (`dist/extension.js`) and webview (`dist/webview/main.js` + `main.css`).
- **`vscode.git` extension dependency** and defensive Git API bootstrap (`getGitApi`).
- Typed **host↔webview protocol** with `protocolVersion`.
- Command **Commit Dock: Focus Commit View** (`commitDock.showCommitView`).
- Bundled **@vscode/codicons** into `dist/webview/codicons/` at build time.
- ESLint, Prettier, `README`, and this changelog.

[Unreleased]: https://github.com/vedanthvdev/commit-dock/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/vedanthvdev/commit-dock/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/vedanthvdev/commit-dock/releases/tag/v0.1.0
