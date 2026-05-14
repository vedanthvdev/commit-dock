import * as vscode from 'vscode';
import type { CommitWebviewProvider } from './views/commitWebviewProvider';

export function registerResourceContextCommands(context: vscode.ExtensionContext, host: CommitWebviewProvider): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.stageResource', (uri?: vscode.Uri) => void host.stageResource(uri)),
    vscode.commands.registerCommand('commitDock.unstageResource', (uri?: vscode.Uri) => void host.unstageResource(uri)),
    vscode.commands.registerCommand('commitDock.openResourceChange', (uri?: vscode.Uri) => void host.openResourceChange(uri)),
    vscode.commands.registerCommand('commitDock.discardResource', (uri?: vscode.Uri) => void host.discardResource(uri)),
    vscode.commands.registerCommand('commitDock.copyResourceRelativePath', (uri?: vscode.Uri) =>
      void host.copyResourceRelativePath(uri),
    ),
  );
}
