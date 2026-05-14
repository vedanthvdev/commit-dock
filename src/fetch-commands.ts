import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { gitExecFileBase } from './git/git-exec';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

const execFileAsync = promisify(execFile);

export function registerFetchCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.fetchAndRefresh', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const root = repo.rootUri.fsPath;
      try {
        await execFileAsync('git', ['fetch', '--all', '--prune'], { cwd: root, maxBuffer: 20_000_000, ...gitExecFileBase });
        void vscode.window.showInformationMessage('Commit Dock: fetch completed.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: fetch failed — ${msg}`);
        return;
      }
      await vscode.commands.executeCommand('commitDock.refreshCommitView');
    }),
  );
}
