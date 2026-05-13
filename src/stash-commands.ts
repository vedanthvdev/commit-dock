import * as vscode from 'vscode';
import { getGitApi } from './git/api';
import { createStashWithRepoApiFallback, type RepoWithOptionalCreateStash } from './git/stash-create-cli';
import { pickPrimaryRepository } from './git/snapshot';

export function registerStashCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.stashWithMessage', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const message = await vscode.window.showInputBox({
        title: 'Stash working tree',
        prompt: 'Optional message (leave empty for the default WIP text). Includes unversioned files, matching Quick stash in the webview.',
        value: 'WIP (Commit Dock)',
        valueSelection: [0, 0],
      });
      if (message === undefined) {
        return;
      }
      const trimmed = message.trim();
      const finalMessage = trimmed.length ? trimmed : 'WIP (Commit Dock)';
      try {
        await createStashWithRepoApiFallback(repo.rootUri.fsPath, repo as unknown as RepoWithOptionalCreateStash, {
          includeUntracked: true,
          message: finalMessage,
        });
        void vscode.window.showInformationMessage('Commit Dock: stash created.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: could not create stash — ${msg}`);
      }
    }),
  );
}
