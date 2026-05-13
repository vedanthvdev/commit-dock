# Changelog

All notable changes to **Commit Dock** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Activity bar badge:** optional count of pending change paths (merge conflicts, staged, unstaged, unversioned) on the Commit Dock icon for the primary repository. Toggle with **`commitDock.showActivityBarBadge`** (default on).
- **Palette Git helpers:** checkout a local branch, create a branch from **HEAD**, and copy the full **HEAD** revision to the clipboard for the primary repository (fixed `git` / `execFile` argument lists).
- **Commit & Push visibility:** optional **`commitDock.showCommitAndPushButton`** (default on) plus host **`uiPreferences`** (protocol **14**) so the webview can hide **Commit and Push** without a reload.
- **Stash shelf copy:** stash tab reads **Shelf** with honest `git stash` tooltips on Apply / Pop / Drop.
- **Change list toolbar:** **Expand all** / **Collapse all** for `<details>` change groups (partial **#28** toolbar parity; directory tree grouping remains future work).

### Changed

- **Docs:** clarify that Marketplace **`/items?itemName=…`** pages can 404 in a browser even when `vsce show` succeeds; document `vscode:extension/…` and `@id:…` install paths.
- **VSIX:** exclude `.github/**` and `vitest.config.ts` from the packaged extension (smaller artifact, less noise in the installed tree).
- **Docs:** step-by-step **VS Code Marketplace** publishing (`VSCE_PAT`, re-run **Release**, local `npm run publish:marketplace`).
- GitHub **default branch** is now **`master`** (was `main`). CI runs on pushes and PRs targeting `master`.

### Planned

- Post-1.0 niceties (multi-repo picker, richer stash create) as separate tickets.

## [0.9.8] - 2026-05-13

### Changed

- [#38](https://github.com/vedanthvdev/commit-dock/pull/38): COMMITDOCK-29-35: Shelf stash copy + Commit & Push toggle

## [0.9.7] - 2026-05-13

### Changed

- [#37](https://github.com/vedanthvdev/commit-dock/pull/37): COMMITDOCK-31-32: Palette branch helpers + copy HEAD SHA

## [0.9.6] - 2026-05-13

### Chore

- Bump version to confirm **Auto-tag** → **`gh workflow run` Release** after merges to `master` (no manual dispatch).

## [0.9.5] - 2026-05-13

### Fixed

- **Marketplace / Release:** use a **128×128 PNG** for `package.json` `icon` (`media/commit-dock-128.png`). `vsce package` rejects SVG icons, which blocked the **Release** workflow from producing a VSIX.

## [0.9.4] - 2026-05-13

### Fixed

- **CI:** restore **`vitest`** in `devDependencies` so `npm ci` installs the test runner (`npm test` was invoking `vitest run` while the dependency was missing from `package.json`).

### Chore

- Bump version to smoke-test **Auto-tag** (with **`TAG_PUSH_TOKEN`**) → **Release** on tag push after merges to `master`.

## [0.9.3] - 2026-05-13

### Added

- **CI:** [`.github/workflows/auto-tag-on-master.yml`](.github/workflows/auto-tag-on-master.yml) runs on pushes to **`master`**. When **`package.json` `version`** changes compared to the previous revision, it **creates and pushes** tag **`v{version}`**, which triggers the existing **Release** workflow (GitHub Release + optional Marketplace).

## [0.9.2] - 2026-05-13

### Added

- **`npm run typecheck`** (`tsc -p .`) and **CI** / **release** workflows run compile + typecheck + lint. CI installs with **`npm ci`** for reproducible builds.

### Changed

- **Dependencies:** refresh dev toolchain (`@vscode/codicons`, `esbuild`, `@vscode/vsce`); **Marketplace publish** in release workflow uses the repo’s **`vsce`** from `npm ci` instead of a hard‑pinned `npx @vscode/vsce@…` version.
- **ESLint:** `eqeqeq` and `no-throw-literal` for stricter, clearer control flow.

### Fixed

- **Webview handler:** uncaught errors in the async message path are logged and surfaced as a single user-visible error instead of failing silently.
- **`git stash list`:** validate repo root (non-empty, no NUL, length cap, directory `stat`), cap parsed lines, and set `windowsHide` / explicit non-shell `execFile` options.
- **Protocol:** cap stash index and reject oversized / NUL‑containing `setPathSelected` paths.

## [0.9.1] - 2026-05-13

### Fixed

- **Release workflow:** create or update the **GitHub Release** (with VSIX) **before** attempting Marketplace publish. Missing **`VSCE_PAT`** no longer fails the job before `gh release create`, which previously left the [Releases](https://github.com/vedanthvdev/commit-dock/releases) page empty for new tags. Marketplace publish is skipped with a notice when the secret is unset.
- **Re-releases:** if a release for the tag already exists, the workflow **uploads** the new VSIX with **`gh release upload --clobber`** instead of failing.

### Changed

- **Stash drop:** removed a redundant toast after a successful drop (the webview list refreshes).

## [0.9.0] - 2026-05-13

### Added

- **Phase 8 — Polish:** **Settings** — `commitDock.snapshotDebounceMs` (0–2000 ms, default 150) for Git snapshot refresh debouncing, and `commitDock.confirmBeforeDiscard` (default on) to skip or require the discard confirmation modal.
- **Commands** use the **Commit Dock** category in the Command Palette; **default keybinding** **Ctrl+Shift+Alt+1** (macOS **Cmd+Shift+Alt+1**) opens the Commit Dock sidebar.
- **README:** settings reference, command list, default shortcut, **limitations** (single active repo, webview vs SCM, stash list `git` on `PATH`), and **Cursor** smoke-test note.

## [0.8.0] - 2026-05-13

### Added

- **Phase 7 — Stashes:** **Stashes** panel with **Refresh**, per-entry **Apply**, **Pop**, and **Drop** (Pop/Drop use **modal confirmations**). List comes from `git stash list` in the active repo; actions use **`vscode.git`** `applyStash`, `popStash`, and `dropStash`. **Protocol v8:** `stashList`, `stashResult`, `requestStashList`, `stashApply`, `stashPop`, `stashDrop`. Conflicts surface via **`stashResult`** / **`stash-hint`** plus **`gitErrorCode`**-aware messages (e.g. `StashConflict`, `UnmergedChanges`).

## [0.7.0] - 2026-05-13

### Added

- **Phase 6 — Push:** **Push** and **Push (force-with-lease)** in the commit panel and palette; force-with-lease requires a **modal confirmation** before calling `repository.push` with `ForcePushMode.ForceWithLease` (protocol **v7**, `pushResult` feedback).
- **Release automation:** GitHub Action **Release** on tags `v*.*.*` that match `package.json` version — runs compile/lint, **`vsce publish`** to the Visual Studio Marketplace (requires **`VSCE_PAT`** repo secret), and creates a **GitHub Release** attaching the VSIX.

## [0.6.0] - 2026-05-13

### Added

- **Phase 5 — Amend:** **Amend previous commit** checkbox (persisted), **`commit(..., { amend: true })`**, and **HEAD message** loading via **`requestHeadCommitMessage`** / **`headCommitMessage`** (protocol **v6**). Empty message with amend reuses the current HEAD message; **empty index** no longer blocks amend-only workflows.

## [0.5.0] - 2026-05-13

### Added

- **Phase 4 — Commit:** multiline **commit message** editor with draft persistence, **Commit** button, and **Ctrl/Cmd+Enter** to submit (protocol **v5**).
- **Index matches selection before commit:** deselected staged paths are **unstaged**, then selected **changes** / **untracked** paths are **staged**, then a plain **`commit`** runs; merge conflicts block the action with clear feedback.
- **Host → webview `commitResult`** for inline status and to reset the busy state.

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
- Command to focus the commit view (`commitDock.showCommitView`).
- Bundled **@vscode/codicons** into `dist/webview/codicons/` at build time.
- ESLint, Prettier, `README`, and this changelog.

[Unreleased]: https://github.com/vedanthvdev/commit-dock/compare/v0.9.3...HEAD
[0.9.3]: https://github.com/vedanthvdev/commit-dock/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/vedanthvdev/commit-dock/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/vedanthvdev/commit-dock/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vedanthvdev/commit-dock/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/vedanthvdev/commit-dock/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/vedanthvdev/commit-dock/releases/tag/v0.1.0
