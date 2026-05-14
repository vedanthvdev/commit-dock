import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { gitExecFileBase } from './git/git-exec';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

const execFileAsync = promisify(execFile);

function isLikelySha(token: string): boolean {
  const t = token.trim();
  return /^[0-9a-f]{7,40}$/i.test(t);
}

async function requireCleanWorkingTree(root: string, action: string): Promise<boolean> {
  try {
    const r = await execFileAsync('git', ['status', '--porcelain'], { cwd: root, maxBuffer: 2_000_000, ...gitExecFileBase });
    if (r.stdout.trim().length > 0) {
      void vscode.window.showWarningMessage(
        `Commit Dock: commit or stash your changes before ${action} (working tree must be clean).`,
      );
      return false;
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(`Commit Dock: could not read git status — ${msg}`);
    return false;
  }
}

export function registerHistoryCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.cherryPickCommit', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const root = repo.rootUri.fsPath;
      if (!(await requireCleanWorkingTree(root, 'cherry-pick'))) {
        return;
      }
      const raw = await vscode.window.showInputBox({
        title: 'Cherry-pick commit',
        prompt: 'Enter a commit SHA (7–40 hex characters) to cherry-pick onto HEAD',
        validateInput: (v) => {
          if (!v.trim()) {
            return 'Enter a commit SHA.';
          }
          if (!isLikelySha(v)) {
            return 'Use a hex SHA (at least 7 characters, at most 40).';
          }
          return undefined;
        },
      });
      if (!raw) {
        return;
      }
      const sha = raw.trim();
      try {
        await execFileAsync('git', ['cherry-pick', sha], { cwd: root, maxBuffer: 2_000_000, ...gitExecFileBase });
        void vscode.window.showInformationMessage(`Commit Dock: cherry-picked ${sha.slice(0, 7)}.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: cherry-pick failed — ${msg}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.revertCommit', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const root = repo.rootUri.fsPath;
      if (!(await requireCleanWorkingTree(root, 'revert'))) {
        return;
      }
      const raw = await vscode.window.showInputBox({
        title: 'Revert commit',
        prompt: 'Enter a commit SHA (7–40 hex characters) to revert with `git revert --no-edit`',
        validateInput: (v) => {
          if (!v.trim()) {
            return 'Enter a commit SHA.';
          }
          if (!isLikelySha(v)) {
            return 'Use a hex SHA (at least 7 characters, at most 40).';
          }
          return undefined;
        },
      });
      if (!raw) {
        return;
      }
      const sha = raw.trim();
      const confirm = await vscode.window.showWarningMessage(
        `Create a new commit that reverts ${sha.slice(0, 7)}?`,
        { modal: true, detail: 'Runs: git revert --no-edit (fails if the commit is not reachable or already reverted).' },
        'Revert',
      );
      if (confirm !== 'Revert') {
        return;
      }
      try {
        await execFileAsync('git', ['revert', '--no-edit', sha], { cwd: root, maxBuffer: 2_000_000, ...gitExecFileBase });
        void vscode.window.showInformationMessage(`Commit Dock: reverted ${sha.slice(0, 7)}.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: revert failed — ${msg}`);
      }
    }),
  );
}
