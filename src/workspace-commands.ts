import * as vscode from 'vscode';

export function registerWorkspaceCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
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
