import * as vscode from 'vscode';
import { registerBranchCommands } from './branch-commands';
import { registerCompareCommands } from './compare-commands';
import { registerFetchCommands } from './fetch-commands';
import { registerHistoryCommands } from './history-commands';
import { registerMergeConflictDiffCommands } from './merge-conflict-diff-commands';
import { registerMergeToolCommands } from './merge-tool-commands';
import { registerPullCommands } from './pull-commands';
import { registerRecentCommitsCommands } from './recent-commits-commands';
import { registerStashCommands } from './stash-commands';
import { registerWorkspaceCommands } from './workspace-commands';
import { CommitWebviewProvider } from './views/commitWebviewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  registerBranchCommands(context);
  registerFetchCommands(context);
  registerCompareCommands(context);
  registerHistoryCommands(context);
  registerMergeConflictDiffCommands(context);
  registerMergeToolCommands(context);
  registerStashCommands(context);
  registerRecentCommitsCommands(context);
  registerPullCommands(context);
  registerWorkspaceCommands(context);
  const provider = new CommitWebviewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CommitWebviewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.showCommitView', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.commit-dock');
    }),
  );
}

export function deactivate(): void {}
