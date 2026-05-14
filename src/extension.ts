import * as vscode from 'vscode';
import { registerBranchCommands } from './branch-commands';
import { registerCompareCommands } from './compare-commands';
import { registerDiffStatCommands } from './diff-stat-commands';
import { registerFetchCommands } from './fetch-commands';
import { registerGraphCommands } from './graph-commands';
import { registerHistoryCommands } from './history-commands';
import { registerMergeConflictDiffCommands } from './merge-conflict-diff-commands';
import { registerMergeToolCommands } from './merge-tool-commands';
import { registerPullCommands } from './pull-commands';
import { registerRecentCommitsCommands } from './recent-commits-commands';
import { registerRemoteCommands } from './remote-commands';
import { registerResourceContextCommands } from './resource-context-commands';
import { registerStashCommands } from './stash-commands';
import { registerStatusCommands } from './status-commands';
import { registerWorkspaceCommands } from './workspace-commands';
import { registerCommitViewPlacement, focusCommitDockViews } from './view-placement';
import { CommitWebviewProvider } from './views/commitWebviewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  registerCommitViewPlacement(context);
  registerBranchCommands(context);
  registerFetchCommands(context);
  registerRemoteCommands(context);
  registerGraphCommands(context);
  registerCompareCommands(context);
  registerDiffStatCommands(context);
  registerHistoryCommands(context);
  registerMergeConflictDiffCommands(context);
  registerMergeToolCommands(context);
  registerStashCommands(context);
  registerRecentCommitsCommands(context);
  registerPullCommands(context);
  registerStatusCommands(context);
  registerWorkspaceCommands(context);
  const provider = new CommitWebviewProvider(context.extensionUri, context);
  registerResourceContextCommands(context, provider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CommitWebviewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
    vscode.window.registerWebviewViewProvider(CommitWebviewProvider.panelViewType, provider, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.showCommitView', async () => {
      await focusCommitDockViews();
    }),
  );
}

export function deactivate(): void {}
