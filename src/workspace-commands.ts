import * as vscode from 'vscode';
import { getGitApi } from './git/api';
import { headRefClipboardText, pickPrimaryRepository } from './git/snapshot';

export function registerWorkspaceCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.copyHeadBranchName', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const text = headRefClipboardText(repo.state.HEAD);
      if (!text) {
        void vscode.window.showWarningMessage('Commit Dock: no HEAD reference to copy.');
        return;
      }
      await vscode.env.clipboard.writeText(text);
      void vscode.window.showInformationMessage(`Commit Dock: copied ${text}`);
    }),

    vscode.commands.registerCommand('commitDock.openTerminalAtPrimaryRepo', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      const fsPath = repo?.rootUri.fsPath;
      if (!fsPath) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const terminal = vscode.window.createTerminal({ cwd: fsPath, name: 'Commit Dock' });
      terminal.show();
    }),

    vscode.commands.registerCommand('commitDock.revealPrimaryRepoInOS', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      const fsPath = repo?.rootUri.fsPath;
      if (!fsPath) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(fsPath));
    }),

    vscode.commands.registerCommand('commitDock.copyActiveEditorRelativePath', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showWarningMessage('Commit Dock: no active editor.');
        return;
      }
      const uri = editor.document.uri;
      if (uri.scheme !== 'file') {
        void vscode.window.showWarningMessage('Commit Dock: active editor is not a file on disk.');
        return;
      }
      const rel = vscode.workspace.asRelativePath(uri, false);
      if (!rel || rel === uri.fsPath) {
        void vscode.window.showWarningMessage('Commit Dock: active file is not under the open workspace.');
        return;
      }
      await vscode.env.clipboard.writeText(rel);
      void vscode.window.showInformationMessage(`Commit Dock: copied ${rel}`);
    }),
  );
}
