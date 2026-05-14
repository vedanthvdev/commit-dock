import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { gitExecFileBase } from './git/git-exec';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

const execFileAsync = promisify(execFile);

export function registerStatusCommands(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel('Commit Dock: Status');
  context.subscriptions.push(channel);

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.showShortGitStatus', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const root = repo.rootUri.fsPath;
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['-c', 'core.pager=cat', 'status', '-sb', '--untracked-files=all'],
          { cwd: root, maxBuffer: 2_000_000, ...gitExecFileBase },
        );
        channel.clear();
        channel.appendLine(stdout.trimEnd());
        channel.show(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: could not read git status — ${msg}`);
      }
    }),
  );
}
