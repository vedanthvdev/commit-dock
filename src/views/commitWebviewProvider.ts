import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfirmBeforeDiscard, getSnapshotDebounceMs } from '../config';
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
import { listHeadCommitRelativePaths } from '../git/head-commit-files';
import { createStashWithRepoApiFallback, type RepoWithOptionalCreateStash } from '../git/stash-create-cli';
import { restoreWorkingTreePathsCli } from '../git/worktree-restore';
import {
  PROTOCOL_VERSION,
  parseWebviewMessage,
  type AmendHeadFileEntry,
  type HostToWebviewMessage,
  type StashSnapshotEntry,
} from '../protocol';
import { ForcePushMode, type API, type Repository } from '../git/git-api';
import { listGitStashes } from '../git/stash-list';

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
    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.push', () => {
        void this.push();
      }),
    );
    this._context.subscriptions.push(
      vscode.commands.registerCommand('commitDock.pushForceWithLease', () => {
        void this.pushForceWithLease();
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
        try {
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
            if (msg.type === 'commit' || msg.type === 'commitAndPush') {
              this._postCommitResult(false, 'No Git repository is active.');
            }
            if (msg.type === 'refreshView' || msg.type === 'quickStash' || msg.type === 'openDiff') {
              return;
            }
            if (msg.type === 'requestHeadCommitMessage') {
              this._postHeadCommitMessage(false, undefined, 'No Git repository is active.');
            }
            if (msg.type === 'push') {
              this._postPushResult(false, 'No Git repository is active.');
            }
            if (msg.type === 'requestStashList') {
              this._postStashListMessage({ ok: true, entries: [] });
              return;
            }
            if (msg.type === 'stashApply' || msg.type === 'stashPop' || msg.type === 'stashDrop') {
              this._postStashResult(false, 'No Git repository is active.');
              return;
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

          if (msg.type === 'refreshView') {
            this._postSnapshotImmediate(repo);
            return;
          }

          if (msg.type === 'quickStash') {
            await this._quickStash(repo);
            return;
          }

          if (msg.type === 'openDiff') {
            await this._openDiffForPath(repo, msg.payload.path);
            return;
          }

          if (msg.type === 'commit') {
            await this._commit(repo, set, msg.payload.message, msg.payload.amend === true);
            return;
          }

          if (msg.type === 'commitAndPush') {
            const committed = await this._commit(repo, set, msg.payload.message, msg.payload.amend === true);
            if (committed) {
              await this._gitPush(repo, false);
            }
            return;
          }

          if (msg.type === 'requestHeadCommitMessage') {
            await this._sendHeadCommitMessage(repo);
            return;
          }

          if (msg.type === 'push') {
            await this._gitPush(repo, msg.payload.forceWithLease === true);
            return;
          }

          if (msg.type === 'requestStashList') {
            void this._refreshStashList(repo);
            return;
          }

          if (msg.type === 'stashApply') {
            void this._stashApply(repo, msg.payload.index);
            return;
          }

          if (msg.type === 'stashPop') {
            void this._stashPop(repo, msg.payload.index);
            return;
          }

          if (msg.type === 'stashDrop') {
            void this._stashDrop(repo, msg.payload.index);
            return;
          }
        } catch (err) {
          console.error('[commit-dock] webview message handler failed', err);
          void vscode.window.showErrorMessage(
            `Commit Dock: unexpected error — ${err instanceof Error ? err.message : String(err)}`,
          );
          const repoAfterError = this._currentRepo;
          if (repoAfterError) {
            void this._postSnapshotImmediate(repoAfterError);
          }
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

  push(): void {
    const repo = this._currentRepo;
    if (!repo) {
      void vscode.window.showWarningMessage('Commit Dock: no repository is active.');
      return;
    }
    void this._gitPush(repo, false);
  }

  pushForceWithLease(): void {
    const repo = this._currentRepo;
    if (!repo) {
      void vscode.window.showWarningMessage('Commit Dock: no repository is active.');
      return;
    }
    void this._gitPush(repo, true);
  }

  private _showGitError(operation: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Commit Dock: ${operation} failed — ${detail}`);
  }

  private _stashErrorDetail(err: unknown): string {
    const e = err as { gitErrorCode?: string };
    const code = typeof e?.gitErrorCode === 'string' ? e.gitErrorCode : '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'StashConflict' || /conflict/i.test(msg)) {
      return `Stash conflict: resolve files in the Conflicted group, then commit or stash. ${msg}`;
    }
    if (code === 'UnmergedChanges') {
      return `Unmerged changes present: resolve conflicts before applying or popping a stash. ${msg}`;
    }
    if (code === 'LocalChangesOverwritten') {
      return `Local changes would be overwritten: commit or stash your work, then retry. ${msg}`;
    }
    return msg;
  }

  private _postStashListMessage(payload: {
    ok: boolean;
    entries: StashSnapshotEntry[];
    detail?: string;
  }): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'stashList',
      payload,
    };
    void view.webview.postMessage(msg);
  }

  private _postStashResult(ok: boolean, detail?: string): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'stashResult',
      payload: { ok, detail },
    };
    void view.webview.postMessage(msg);
  }

  private async _refreshStashList(repo: Repository): Promise<void> {
    try {
      const entries = await listGitStashes(repo.rootUri.fsPath);
      this._postStashListMessage({ ok: true, entries });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this._postStashListMessage({ ok: false, entries: [], detail });
    }
  }

  private async _stashApply(repo: Repository, index: number): Promise<void> {
    try {
      await repo.applyStash(index);
    } catch (err) {
      this._showGitError('Apply stash', err);
      this._postStashResult(false, this._stashErrorDetail(err));
      this._postSnapshotImmediate(repo);
      return;
    }
    this._postStashResult(true);
    this._postSnapshotImmediate(repo);
  }

  private async _stashPop(repo: Repository, index: number): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Pop stash@{${index}}?`,
      {
        modal: true,
        detail: 'Removes this stash entry when the pop succeeds. If Git reports conflicts, resolve them in the Conflicted group.',
      },
      'Pop stash',
    );
    if (confirm !== 'Pop stash') {
      this._postStashResult(false, 'Cancelled.');
      return;
    }
    try {
      await repo.popStash(index);
    } catch (err) {
      this._showGitError('Pop stash', err);
      this._postStashResult(false, this._stashErrorDetail(err));
      this._postSnapshotImmediate(repo);
      return;
    }
    this._postStashResult(true);
    this._postSnapshotImmediate(repo);
  }

  private async _stashDrop(repo: Repository, index: number): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Drop stash@{${index}}?`,
      { modal: true, detail: 'This permanently deletes that stash entry from Git.' },
      'Drop stash',
    );
    if (confirm !== 'Drop stash') {
      this._postStashResult(false, 'Cancelled.');
      return;
    }
    try {
      await repo.dropStash(index);
    } catch (err) {
      this._showGitError('Drop stash', err);
      this._postStashResult(false, err instanceof Error ? err.message : String(err));
      this._postSnapshotImmediate(repo);
      return;
    }
    this._postStashResult(true);
    this._postSnapshotImmediate(repo);
  }

  private async _stageSelected(repo: Repository, set: Set<string>): Promise<void> {
    try {
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
    } finally {
      this._postSnapshotImmediate(repo);
    }
  }

  private async _unstageSelected(repo: Repository, set: Set<string>): Promise<void> {
    try {
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
    } finally {
      this._postSnapshotImmediate(repo);
    }
  }

  private async _discardSelected(repo: Repository, set: Set<string>): Promise<void> {
    try {
      const selected = getSelectedSelectablePaths(repo, set);
      const { clean, restore } = pathsToDiscard(repo, selected);
      if (!clean.length && !restore.length) {
        return;
      }
      if (getConfirmBeforeDiscard()) {
        const total = clean.length + restore.length;
        const confirm = await vscode.window.showWarningMessage(
          `Discard ${total} selected file(s)? Untracked files are deleted from disk; tracked files are reverted in the working tree.`,
          { modal: true, detail: 'Staged content is not modified. Unstage first if you need to drop index changes.' },
          'Discard',
        );
        if (confirm !== 'Discard') {
          return;
        }
      }
      try {
        if (clean.length) {
          await repo.clean(clean);
        }
        if (restore.length) {
          const r = repo as unknown as {
            restore?: (paths: string[], options?: { staged?: boolean; ref?: string }) => Promise<void>;
          };
          if (typeof r.restore === 'function') {
            try {
              await r.restore(restore, {});
            } catch {
              await restoreWorkingTreePathsCli(repo.rootUri.fsPath, restore);
            }
          } else {
            await restoreWorkingTreePathsCli(repo.rootUri.fsPath, restore);
          }
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
    } finally {
      this._postSnapshotImmediate(repo);
    }
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

  private _postHeadCommitMessage(ok: boolean, message?: string, detail?: string): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'headCommitMessage',
      payload: { ok, message, detail },
    };
    void view.webview.postMessage(msg);
  }

  private async _sendHeadCommitMessage(repo: Repository): Promise<void> {
    try {
      const ref = repo.state.HEAD?.commit;
      if (!ref) {
        this._postHeadCommitMessage(false, undefined, 'There is no commit to amend.');
        return;
      }
      const commit = await repo.getCommit(ref);
      const message = commit.message.replace(/\r\n/g, '\n');
      this._postHeadCommitMessage(true, message, undefined);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this._postHeadCommitMessage(false, undefined, detail);
    }
  }

  private async _commit(repo: Repository, set: Set<string>, message: string, amend: boolean): Promise<boolean> {
    if (repo.state.mergeChanges.length > 0) {
      this._postCommitResult(false, 'Resolve merge conflicts before committing.');
      void vscode.window.showErrorMessage('Commit Dock: resolve merge conflicts before committing.');
      return false;
    }

    let body = message.trim();
    if (amend && !body) {
      const ref = repo.state.HEAD?.commit;
      if (!ref) {
        this._postCommitResult(false, 'There is no commit to amend.');
        return false;
      }
      try {
        const head = await repo.getCommit(ref);
        body = head.message.replace(/\r\n/g, '\n').trimEnd();
      } catch (err) {
        this._showGitError('Load HEAD commit', err);
        this._postCommitResult(false, err instanceof Error ? err.message : String(err));
        return false;
      }
    }

    if (!body) {
      this._postCommitResult(false, 'Enter a commit message.');
      return false;
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
      if (!amend && repo.state.indexChanges.length === 0) {
        this._postCommitResult(false, 'Nothing to commit (index is empty).');
        void vscode.window.showInformationMessage('Commit Dock: nothing to commit.');
        return false;
      }
      await repo.commit(body, amend ? { amend: true } : undefined);
    } catch (err) {
      this._showGitError('Commit', err);
      this._postCommitResult(false, err instanceof Error ? err.message : String(err));
      return false;
    }
    this._postCommitResult(true);
    this._postSnapshotImmediate(repo);
    return true;
  }

  private async _quickStash(repo: Repository): Promise<void> {
    try {
      await createStashWithRepoApiFallback(repo.rootUri.fsPath, repo as unknown as RepoWithOptionalCreateStash, {
        includeUntracked: true,
        message: 'WIP (Commit Dock)',
      });
      this._postStashResult(true);
    } catch (err) {
      this._showGitError('Create stash', err);
      this._postStashResult(false, err instanceof Error ? err.message : String(err));
    } finally {
      this._postSnapshotImmediate(repo);
    }
  }

  private async _openDiffForPath(repo: Repository, fsPath: string): Promise<void> {
    const normPath = path.normalize(fsPath);
    const normRoot = path.normalize(repo.rootUri.fsPath);
    if (normPath !== normRoot && !normPath.startsWith(`${normRoot}${path.sep}`)) {
      return;
    }
    const uri = vscode.Uri.file(normPath);
    try {
      await vscode.commands.executeCommand('git.openChange', uri);
    } catch {
      try {
        await vscode.window.showTextDocument(uri);
      } catch {
        void vscode.window.showWarningMessage('Commit Dock: could not open a diff for that file.');
      }
    }
  }

  private _postPushResult(ok: boolean, detail?: string): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'pushResult',
      payload: { ok, detail },
    };
    void view.webview.postMessage(msg);
  }

  private async _gitPush(repo: Repository, forceWithLease: boolean): Promise<void> {
    if (forceWithLease) {
      const confirm = await vscode.window.showWarningMessage(
        'Force push with lease to the configured upstream?',
        {
          modal: true,
          detail:
            'The push is rejected if the remote moved on since your last fetch. This can still rewrite remote history — confirm only if you intend to update the remote branch.',
        },
        'Force push with lease',
      );
      if (confirm !== 'Force push with lease') {
        this._postPushResult(false, 'Cancelled.');
        return;
      }
    }
    try {
      if (forceWithLease) {
        await repo.push(undefined, undefined, false, ForcePushMode.ForceWithLease);
      } else {
        await repo.push();
      }
    } catch (err) {
      this._showGitError('Push', err);
      this._postPushResult(false, err instanceof Error ? err.message : String(err));
      return;
    }
    void vscode.window.showInformationMessage(
      forceWithLease ? 'Commit Dock: force-with-lease push completed.' : 'Commit Dock: push completed.',
    );
    this._postPushResult(true);
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
      this._postStashListMessage({ ok: true, entries: [] });
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
      this._postStashListMessage({ ok: true, entries: [] });
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

  private _scheduleSnapshot(repo: Repository, delayMs?: number): void {
    const ms = delayMs === 0 ? 0 : (delayMs ?? getSnapshotDebounceMs());
    if (this._debounce) {
      clearTimeout(this._debounce);
    }
    this._debounce = setTimeout(() => {
      this._debounce = undefined;
      this._postSnapshot(repo);
    }, ms);
  }

  private _postSnapshotImmediate(repo: Repository): void {
    if (this._debounce) {
      clearTimeout(this._debounce);
      this._debounce = undefined;
    }
    this._postSnapshot(repo);
  }

  private async _postSnapshot(repo: Repository): Promise<void> {
    const view = this._view;
    if (!view) {
      return;
    }

    this._currentRepo = repo;
    this._pruneDeselected(repo);

    const set = this._getOrCreateDeselectedSet(repo.rootUri.fsPath);
    const base = buildRepoSnapshot(repo, set);

    let amendHeadFiles: readonly AmendHeadFileEntry[] | undefined;
    try {
      const rels = await listHeadCommitRelativePaths(repo.rootUri.fsPath);
      const rootResolved = path.resolve(repo.rootUri.fsPath);
      const entries: AmendHeadFileEntry[] = [];
      const seenAbs = new Set<string>();
      for (const rel of rels) {
        if (rel.includes('\0')) {
          continue;
        }
        const abs = path.isAbsolute(rel) ? path.resolve(rel) : path.resolve(rootResolved, rel);
        const relativeFromRoot = path.relative(rootResolved, abs);
        if (relativeFromRoot === '..' || relativeFromRoot.startsWith(`..${path.sep}`)) {
          continue;
        }
        const normAbs = path.normalize(abs);
        const dedupeKey = normAbs.toLowerCase();
        if (seenAbs.has(dedupeKey)) {
          continue;
        }
        seenAbs.add(dedupeKey);
        const uri = vscode.Uri.file(normAbs);
        const relPath = vscode.workspace.asRelativePath(uri, true) || rel;
        entries.push({ path: normAbs, relPath });
      }
      if (entries.length > 0) {
        amendHeadFiles = entries;
      }
    } catch {
      amendHeadFiles = undefined;
    }

    const payload = amendHeadFiles ? { ...base, amendHeadFiles } : base;
    const msg: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'repoSnapshot',
      payload,
    };
    void view.webview.postMessage(msg);
    void this._refreshStashList(repo);
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
      <span class="codicon codicon-git-commit header__icon" aria-hidden="true"></span>
      <div class="header__text">
        <span id="title" class="header__title">Commit Dock</span>
        <p id="status" class="status">Loading…</p>
      </div>
    </header>

    <div id="workspace" class="workspace" hidden>
      <nav class="tab-strip" role="tablist" aria-label="Commit Dock">
        <button
          type="button"
          class="tab-strip__tab tab-strip__tab--active"
          id="tab-commit"
          role="tab"
          aria-selected="true"
          aria-controls="tab-panel-commit"
          data-tab="commit"
        >
          Commit
        </button>
        <button
          type="button"
          class="tab-strip__tab"
          id="tab-stash"
          role="tab"
          aria-selected="false"
          aria-controls="tab-panel-stash"
          data-tab="stash"
        >
          Stash
        </button>
      </nav>

      <div class="tab-panels">
        <div
          id="tab-panel-commit"
          class="tab-panel tab-panel--active"
          role="tabpanel"
          aria-labelledby="tab-commit"
        >
          <p id="repo" class="repo repo--ellipsis" hidden></p>
          <section id="changes" class="changes changes--scroll" hidden tabindex="-1"></section>
          <footer id="commit-panel" class="commit-dock-footer">
            <label class="sr-only" for="commit-message">Commit message</label>
            <div class="commit-dock-footer__row commit-dock-footer__row--amend">
              <label class="commit-dock-footer__check" for="commit-amend">
                <input type="checkbox" id="commit-amend" />
                <span>Amend last commit</span>
              </label>
            </div>
            <div class="commit-dock-footer__message-slot">
              <textarea
                id="commit-message"
                class="commit-dock-footer__textarea"
                rows="6"
                spellcheck="true"
                placeholder="Commit message"
              ></textarea>
            </div>
            <p id="action-status" class="action-status" role="status" aria-live="polite" hidden></p>
            <div class="commit-dock-footer__row commit-dock-footer__row--actions commit-dock-footer__row--primary">
              <button type="button" id="commit-submit" class="selection-toolbar__btn selection-toolbar__btn--primary">Commit</button>
              <button type="button" id="commit-and-push" class="selection-toolbar__btn selection-toolbar__btn--outline">Commit and Push…</button>
            </div>
            <div class="commit-dock-footer__row commit-dock-footer__row--actions commit-dock-footer__row--secondary">
              <button type="button" id="commit-push-fwl" class="selection-toolbar__btn selection-toolbar__btn--danger" title="Push with --force-with-lease (confirms before running)">
                Push (force-with-lease)
              </button>
            </div>
            <p id="commit-hint" class="hint commit-dock-footer__hint" hidden></p>
          </footer>
        </div>

        <div id="tab-panel-stash" class="tab-panel" role="tabpanel" aria-labelledby="tab-stash" hidden>
          <section id="stash-panel" class="stash-panel stash-panel--tab">
            <div class="stash-toolbar">
              <span class="stash-toolbar__title">Stashes</span>
              <button type="button" id="stash-refresh" class="toolbar-icon-btn" title="Refresh stash list" aria-label="Refresh stash list">
                <span class="codicon codicon-sync" aria-hidden="true"></span>
              </button>
            </div>
            <p id="stash-hint" class="hint stash-panel__hint" hidden></p>
            <ul id="stash-list" class="stash-list stash-list--scroll"></ul>
          </section>
        </div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return randomBytes(16).toString('hex');
}
