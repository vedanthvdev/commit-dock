# Commit Dock

**Commit Dock** is a [Visual Studio Code](https://code.visualstudio.com/) and **Cursor** extension that brings an IntelliJ-style commit workflow into the editor: one consistent **webview** for changed files, commit message, amend, stash, and safe push options.

> **Status:** current release is **`v0.4.0`** (Phase 3: stage, unstage, and discard selected changes). Next: commit message and plain commit. See [CHANGELOG.md](CHANGELOG.md).

## Requirements

- VS Code **≥ 1.85** (or Cursor with a compatible VS Code engine).
- Built-in **Git** extension enabled (`vscode.git`).

## Development

The default Git branch for this repository is **`master`**.

```bash
git checkout master
npm install
npm run compile   # or npm run watch
npm run package   # produces .vsce / vsce package
```

Press **F5** in VS Code to launch the **Extension Development Host**. Open the **Commit Dock** icon in the activity bar.

CI runs on **pushes to `master`** and on **pull requests targeting `master`**.

## Versioning

Versions follow **SemVer** (`MAJOR.MINOR.PATCH`). Changes are recorded in [CHANGELOG.md](CHANGELOG.md). Git branches for work items use the pattern **`COMMITDOCK-XXXX`** (one branch, one commit before merge to **`master`**, amended if iterating on the same branch).

## Repository

- [github.com/vedanthvdev/commit-dock](https://github.com/vedanthvdev/commit-dock)

## License

MIT — see [LICENSE](LICENSE).
