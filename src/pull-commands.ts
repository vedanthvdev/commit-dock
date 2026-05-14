import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { gitExecFileBase } from './git/git-exec';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

const execFileAsync = promisify(execFile);

async function requireCleanWorkingTree(root: string): Promise<boolean> {
  try {
    const r = await execFileAsync('git', ['status', '--porcelain'], { cwd: root, maxBuffer: 2_000_000, ...gitExecFileBase });
    if (r.stdout.trim().length > 0) {
      void vscode.window.showWarningMessage(
        'Commit Dock: commit or stash your changes before pulling (working tree must be clean).',
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

export function registerPullCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.pullFastForwardOnly', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const root = repo.rootUri.fsPath;
      if (!(await requireCleanWorkingTree(root))) {
        return;
      }
      try {
        const { stdout, stderr } = await execFileAsync(
          'git',
          ['-c', 'core.pager=cat', 'pull', '--ff-only'],
          {
            cwd: root,
            maxBuffer: 2_000_000,
            ...gitExecFileBase,
          },
        );
        const out = `${stdout}${stderr}`.trim();
        void vscode.window.showInformationMessage(
          out ? `Commit Dock: pull completed — ${out.slice(0, 240)}${out.length > 240 ? '…' : ''}` : 'Commit Dock: pull completed.',
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: pull failed — ${msg}`);
      }
    }),
  );
}
