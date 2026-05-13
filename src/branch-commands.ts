import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

const execFileAsync = promisify(execFile);

async function primaryRepoRoot(): Promise<string | undefined> {
  const api = await getGitApi({ silent: true });
  const repo = api ? pickPrimaryRepository(api) : undefined;
  return repo?.rootUri.fsPath;
}

function isSafeLocalBranchName(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 200) {
    return false;
  }
  if (t.startsWith('-') || t.endsWith('.') || t.endsWith('/') || t.includes('..')) {
    return false;
  }
  return /^[\w./+@-]+$/.test(t);
}

export function registerBranchCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.checkoutLocalBranch', async () => {
      const root = await primaryRepoRoot();
      if (!root) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      let stdout: string;
      try {
        const r = await execFileAsync('git', ['for-each-ref', 'refs/heads', '--format=%(refname:short)'], {
          cwd: root,
          maxBuffer: 2_000_000,
        });
        stdout = r.stdout;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: could not list branches — ${msg}`);
        return;
      }
      const branches = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      if (!branches.length) {
        void vscode.window.showWarningMessage('Commit Dock: no local branches found.');
        return;
      }
      const picked = await vscode.window.showQuickPick(branches, {
        title: 'Checkout local branch',
        placeHolder: 'Pick a branch to check out',
      });
      if (!picked) {
        return;
      }
      try {
        await execFileAsync('git', ['checkout', picked], { cwd: root });
        void vscode.window.showInformationMessage(`Commit Dock: checked out ${picked}.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: checkout failed — ${msg}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.createBranchFromHead', async () => {
      const root = await primaryRepoRoot();
      if (!root) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const name = await vscode.window.showInputBox({
        title: 'Create branch from HEAD',
        prompt: 'New branch name (created at the current HEAD)',
        validateInput: (v) => {
          if (!isSafeLocalBranchName(v)) {
            return 'Use a short branch name (letters, numbers, /, ., _, +, @, -). No spaces or .. sequences.';
          }
          return undefined;
        },
      });
      if (!name) {
        return;
      }
      const branch = name.trim();
      try {
        await execFileAsync('git', ['checkout', '-b', branch], { cwd: root });
        void vscode.window.showInformationMessage(`Commit Dock: created and checked out ${branch}.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: could not create branch — ${msg}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.copyHeadRevision', async () => {
      const root = await primaryRepoRoot();
      if (!root) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
        const sha = stdout.trim();
        if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
          void vscode.window.showErrorMessage('Commit Dock: unexpected output from git rev-parse.');
          return;
        }
        await vscode.env.clipboard.writeText(sha);
        void vscode.window.showInformationMessage(`Commit Dock: copied revision ${sha.slice(0, 7)}…`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: could not read HEAD — ${msg}`);
      }
    }),
  );
}
