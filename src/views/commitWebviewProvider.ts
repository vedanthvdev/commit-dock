import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getGitApi } from '../git/api';
import {
  buildRepoSnapshot,
  emptyRepoSnapshot,
  getAllSelectablePaths,
  getSelectablePathsForGroup,
  getSelectedSelectablePaths,
  pathsToDiscard,
  pathsToStage,
  pathsStagedAndDeselected,
  pathsToUnstage,
  pickPrimaryRepository,
} from '../git/snapshot';
import { PROTOCOL_VERSION, parseWebviewMessage, type HostToWebviewMessage } from '../protocol';
import type { API, Repository } from '../git/git-api';

export class CommitWebviewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'commitDock.commitView';

  private _view?: vscode.WebviewView;
  private readonly _repoDisposables: vscode.Disposable[] = [];
  private _debounce?: ReturnType<typeof setTimeout>;
  private _subscribedRepoRoot?: string;
  private _didRegisterGlobalGitListeners = false;
  private readonly _deselectedByRepoRoot = new Map<string, Set<string>>();
  private _currentRepo?: Repository;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {
    this._context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        void this._onGitContextMaybeChanged();
      }),
    );
    this._context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void this._onGitContextMaybeChanged();
      }),
    );

    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.selectAll', () => {
        this.selectAll();
      }),
    );
    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.deselectAll', () => {
        this.deselectAll();
      }),
    );
    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.stageSelected', () => {
        void this.stageSelected();
      }),
    );
    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.unstageSelected', () => {
        void this.unstageSelected();
      }),
    );
    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.discardSelected', () => {
        void this.discardSelected();
      }),
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')],
    };

    const nonce = getNonce();
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, nonce);

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      webviewView.webview.onDidReceiveMessage(async (data: unknown) => {
        const msg = parseWebviewMessage(data);
        if (!msg) {
          return;
        }
        if (msg.type === 'ready') {
          await this._pushInitialState();
          return;
        }
        if (msg.type === 'noop') {
          return;
        }

        if (!this._currentRepo) {
          if (msg.type === 'commit') {
            this._postCommitResult(false, 'No Git repository is active.');
          }
          return;
        }

        const repo = this._currentRepo;
        const root = repo.rootUri.fsPath;
        const set = this._getOrCreateDeselectedSet(root);

        if (msg.type === 'setPathSelected') {
          const p = msg.payload.path;
          const selected = msg.payload.selected;
          if (!this._isSelectablePath(repo, p)) {
            return;
          }
          if (selected) {
            set.delete(p);
          } else {
            set.add(p);
          }
          this._postSnapshotImmediate(repo);
          return;
        }

        if (msg.type === 'setGroupSelection') {
          const group = msg.payload.group;
          const checked = msg.payload.checked;
          const paths = getSelectablePathsForGroup(repo, group);
          for (const p of paths) {
            if (checked) {
              set.delete(p);
            } else {
              set.add(p);
            }
          }
          this._postSnapshotImmediate(repo);
          return;
        }

        if (msg.type === 'selectAll') {
          for (const p of getAllSelectablePaths(repo)) {
            set.delete(p);
          }
          this._postSnapshotImmediate(repo);
          return;
        }

        if (msg.type === 'deselectAll') {
          for (const p of getAllSelectablePaths(repo)) {
            set.add(p);
          }
          this._postSnapshotImmediate(repo);
          return;
        }

        if (msg.type === 'stageSelected') {
          await this._stageSelected(repo, set);
          return;
        }

        if (msg.type === 'unstageSelected') {
          await this._unstageSelected(repo, set);
          return;
        }

        if (msg.type === 'discardSelected') {
          await this._discardSelected(repo, set);
          return;
        }

        if (msg.type === 'commit') {
          await this._commit(repo, set, msg.payload.message);
          return;
        }
      }),
    );

    disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          void this._pushInitialState();
        }
      }),
    );

    webviewView.onDidDispose(() => {
      vscode.Disposable.from(...disposables).dispose();
      this._clearRepoSubscriptions();
      this._subscribedRepoRoot = undefined;
      this._currentRepo = undefined;
      if (this._debounce) {
        clearTimeout(this._debounce);
        this._debounce = undefined;
      }
      if (this._view === webviewView) {
        this._view = undefined;
      }
    });
  }

  selectAll(): void {
    const repo = this._currentRepo;
    if (!repo) {
      return;
    }
    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    for (const p of getAllSelectablePaths(repo)) {
      set.delete(p);
    }
    this._postSnapshotImmediate(repo);
  }

  deselectAll(): void {
    const repo = this._currentRepo;
    if (!repo) {
      return;
    }
    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    for (const p of getAllSelectablePaths(repo)) {
      set.add(p);
    }
    this._postSnapshotImmediate(repo);
  }

  stageSelected(): void {
    const repo = this._currentRepo;
    if (!repo) {
      return;
    }
    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    void this._stageSelected(repo, set);
  }

  unstageSelected(): void {
    const repo = this._currentRepo;
    if (!repo) {
      return;
    }
    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    void this._unstageSelected(repo, set);
  }

  discardSelected(): void {
    const repo = this._currentRepo;
    if (!repo) {
      return;
    }
    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    void this._discardSelected(repo, set);
  }

  private _showGitError(operation: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Commit Dock: ${operation} failed — ${detail}`);
  }

  private async _stageSelected(repo: Repository, set: Set<string>): Promise<void> {
    const selected = getSelectedSelectablePaths(repo, set);
    const toStage = pathsToStage(repo, selected);
    if (!toStage.length) {
      return;
    }
    try {
      await repo.add(toStage);
    } catch (err) {
      this._showGitError('Stage', err);
      return;
    }
    for (const p of toStage) {
      set.delete(p);
    }
    this._postSnapshotImmediate(repo);
  }

  private async _unstageSelected(repo: Repository, set: Set<string>): Promise<void> {
    const selected = getSelectedSelectablePaths(repo, set);
    const toUnstage = pathsToUnstage(repo, selected);
    if (!toUnstage.length) {
      return;
    }
    try {
      await repo.revert(toUnstage);
    } catch (err) {
      this._showGitError('Unstage', err);
      return;
    }
    for (const p of toUnstage) {
      set.delete(p);
    }
    this._postSnapshotImmediate(repo);
  }

  private async _discardSelected(repo: Repository, set: Set<string>): Promise<void> {
    const selected = getSelectedSelectablePaths(repo, set);
    const { clean, restore } = pathsToDiscard(repo, selected);
    if (!clean.length && !restore.length) {
      return;
    }
    const total = clean.length + restore.length;
    const confirm = await vscode.window.showWarningMessage(
      `Discard ${total} selected file(s)? Untracked files are deleted from disk; tracked files are reverted in the working tree.`,
      { modal: true, detail: 'Staged content is not modified. Unstage first if you need to drop index changes.' },
      'Discard',
    );
    if (confirm !== 'Discard') {
      return;
    }
    try {
      if (clean.length) {
        await repo.clean(clean);
      }
      if (restore.length) {
        await repo.restore(restore, {});
      }
    } catch (err) {
      this._showGitError('Discard', err);
      return;
    }
    for (const p of clean) {
      set.delete(p);
    }
    for (const p of restore) {
      set.delete(p);
    }
    this._postSnapshotImmediate(repo);
  }

  private _postCommitResult(ok: boolean, detail?: string): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'commitResult',
      payload: { ok, detail },
    };
    void view.webview.postMessage(msg);
  }

  private async _commit(repo: Repository, set: Set<string>, message: string): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) {
      this._postCommitResult(false, 'Enter a commit message.');
      return;
    }
    if (repo.state.mergeChanges.length > 0) {
      this._postCommitResult(false, 'Resolve merge conflicts before committing.');
      void vscode.window.showErrorMessage('Commit Dock: resolve merge conflicts before committing.');
      return;
    }
    try {
      const toUnstage = pathsStagedAndDeselected(repo, set);
      if (toUnstage.length) {
        await repo.revert(toUnstage);
      }
      const selected = getSelectedSelectablePaths(repo, set);
      const toStage = pathsToStage(repo, selected);
      if (toStage.length) {
        await repo.add(toStage);
      }
      if (repo.state.indexChanges.length === 0) {
        this._postCommitResult(false, 'Nothing to commit (index is empty).');
        void vscode.window.showInformationMessage('Commit Dock: nothing to commit.');
        return;
      }
      await repo.commit(trimmed);
    } catch (err) {
      this._showGitError('Commit', err);
      this._postCommitResult(false, err instanceof Error ? err.message : String(err));
      return;
    }
    this._postCommitResult(true);
    this._postSnapshotImmediate(repo);
  }

  private _registerGitWorkspaceListeners(api: API): void {
    if (this._didRegisterGlobalGitListeners) {
      return;
    }
    this._didRegisterGlobalGitListeners = true;
    this._context.subscriptions.push(
      api.onDidOpenRepository(() => {
        void this._onGitContextMaybeChanged();
      }),
      api.onDidCloseRepository(() => {
        void this._onGitContextMaybeChanged();
      }),
    );
  }

  private async _onGitContextMaybeChanged(): Promise<void> {
    const api = await getGitApi({ silent: true });
    if (!api) {
      return;
    }
    const repo = pickPrimaryRepository(api);
    const root = repo?.rootUri.fsPath;
    if (root && this._subscribedRepoRoot && root !== this._subscribedRepoRoot) {
      this._clearRepoSubscriptions();
      this._subscribedRepoRoot = undefined;
    }
    await this._ensureRepoSubscription(api);
  }

  private async _pushInitialState(): Promise<void> {
    const view = this._view;
    if (!view) {
      return;
    }

    const hello: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'hello',
      payload: { message: 'Commit Dock' },
    };
    void view.webview.postMessage(hello);

    const api = await getGitApi({ silent: true });

    let ok: boolean;
    let detail: string;
    if (!api) {
      ok = false;
      detail =
        'Built-in Git is unavailable or disabled. Enable the Git extension in VS Code settings.';
    } else if (api.repositories.length === 0) {
      ok = false;
      detail = 'Open a folder that contains a Git repository.';
    } else {
      ok = true;
      const n = api.repositories.length;
      detail = `${n} Git repositor${n === 1 ? 'y' : 'ies'} detected.`;
    }

    const gitStatus: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'gitStatus',
      payload: { ok, detail },
    };
    void view.webview.postMessage(gitStatus);

    await this._ensureRepoSubscription(api);
  }

  private _clearRepoSubscriptions(): void {
    while (this._repoDisposables.length) {
      const d = this._repoDisposables.pop();
      d?.dispose();
    }
  }

  private _getOrCreateDeselectedSet(repoRoot: string): Set<string> {
    let set = this._deselectedByRepoRoot.get(repoRoot);
    if (!set) {
      set = new Set<string>();
      this._deselectedByRepoRoot.set(repoRoot, set);
    }
    return set;
  }

  private _pruneDeselected(repo: Repository): void {
    const root = repo.rootUri.fsPath;
    const set = this._deselectedByRepoRoot.get(root);
    if (!set) {
      return;
    }
    const validSelectable = new Set(getAllSelectablePaths(repo));
    for (const p of [...set]) {
      if (!validSelectable.has(p)) {
        set.delete(p);
      }
    }
  }

  private _isSelectablePath(repo: Repository, p: string): boolean {
    return new Set(getAllSelectablePaths(repo)).has(p);
  }

  private async _ensureRepoSubscription(api: API | undefined): Promise<void> {
    const view = this._view;
    if (!view) {
      return;
    }

    if (!api) {
      this._clearRepoSubscriptions();
      this._subscribedRepoRoot = undefined;
      this._currentRepo = undefined;
      const empty = emptyRepoSnapshot();
      const snap: HostToWebviewMessage = {
        protocolVersion: PROTOCOL_VERSION,
        type: 'repoSnapshot',
        payload: empty,
      };
      void view.webview.postMessage(snap);
      return;
    }

    this._registerGitWorkspaceListeners(api);

    const repo = pickPrimaryRepository(api);
    if (!repo) {
      this._clearRepoSubscriptions();
      this._subscribedRepoRoot = undefined;
      this._currentRepo = undefined;
      const empty = emptyRepoSnapshot();
      const snap: HostToWebviewMessage = {
        protocolVersion: PROTOCOL_VERSION,
        type: 'repoSnapshot',
        payload: empty,
      };
      void view.webview.postMessage(snap);
      return;
    }

    const root = repo.rootUri.fsPath;
    if (this._subscribedRepoRoot !== root) {
      this._clearRepoSubscriptions();
      this._subscribedRepoRoot = root;
      this._getOrCreateDeselectedSet(root);

      this._repoDisposables.push(
        repo.state.onDidChange(() => {
          this._scheduleSnapshot(repo);
        }),
      );
      this._repoDisposables.push(
        repo.onDidCommit(() => {
          this._scheduleSnapshot(repo);
        }),
      );
    }

    this._scheduleSnapshot(repo, 0);
  }

  private _scheduleSnapshot(repo: Repository, delayMs = 150): void {
    if (this._debounce) {
      clearTimeout(this._debounce);
    }
    this._debounce = setTimeout(() => {
      this._debounce = undefined;
      this._postSnapshot(repo);
    }, delayMs);
  }

  private _postSnapshotImmediate(repo: Repository): void {
    if (this._debounce) {
      clearTimeout(this._debounce);
      this._debounce = undefined;
    }
    this._postSnapshot(repo);
  }

  private _postSnapshot(repo: Repository): void {
    const view = this._view;
    if (!view) {
      return;
    }

    this._currentRepo = repo;
    this._pruneDeselected(repo);

    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    const payload = buildRepoSnapshot(repo, set);
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'repoSnapshot',
      payload,
    };
    void view.webview.postMessage(msg);
  }

  private _getHtmlForWebview(webview: vscode.Webview, nonce: string): string {
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} https: data:`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.css'));
    const codiconsFsPath = path.join(this._extensionUri.fsPath, 'dist', 'webview', 'codicons', 'codicon.css');
    const codiconsCss = fs.existsSync(codiconsFsPath)
      ? webview.asWebviewUri(vscode.Uri.file(codiconsFsPath)).toString()
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  ${codiconsCss ? `<link href="${codiconsCss}" rel="stylesheet" nonce="${nonce}" />` : ''}
  <link href="${styleUri}" rel="stylesheet" nonce="${nonce}" />
  <title>Commit Dock</title>
</head>
<body>
  <div id="app" class="app">
    <header class="header">
      <span class="codicon codicon-git-commit"></span>
      <span id="title">Commit Dock</span>
    </header>
    <main class="main">
      <p id="status" class="status">Loading…</p>
      <p id="repo" class="repo" hidden></p>
      <section id="commit-panel" class="commit-panel" hidden>
        <label class="commit-panel__label" for="commit-message">Commit message</label>
        <textarea id="commit-message" class="commit-panel__textarea" rows="4" spellcheck="true" placeholder="Describe your changes"></textarea>
        <div class="commit-panel__row">
          <button type="button" id="commit-submit" class="selection-toolbar__btn selection-toolbar__btn--primary">Commit</button>
        </div>
        <p id="commit-hint" class="hint commit-panel__hint" hidden></p>
      </section>
      <section id="changes" class="changes" hidden tabindex="-1"></section>
    </main>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return randomBytes(16).toString('hex');
}
