import * as vscode from 'vscode';
import { registerBranchCommands } from './branch-commands';
import { registerMergeConflictDiffCommands } from './merge-conflict-diff-commands';
import { registerMergeToolCommands } from './merge-tool-commands';
import { CommitWebviewProvider } from './views/commitWebviewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  registerBranchCommands(context);
  registerMergeConflictDiffCommands(context);
  registerMergeToolCommands(context);
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
