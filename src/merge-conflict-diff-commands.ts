import * as path from 'node:path';
import * as vscode from 'vscode';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';
import type { Repository } from './git/git-api';

async function openGitChangeForRepoPath(repo: Repository, fsPath: string): Promise<void> {
  if (fsPath.includes('\0')) {
    return;
  }
  const rootResolved = path.resolve(repo.rootUri.fsPath);
  const abs = path.resolve(fsPath);
  const rel = path.relative(rootResolved, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    void vscode.window.showWarningMessage('Commit Dock: conflict path is outside the repository root.');
    return;
  }
  const uri = vscode.Uri.file(abs);
  try {
    await vscode.commands.executeCommand('git.openChange', uri);
  } catch {
    try {
      await vscode.window.showTextDocument(uri);
    } catch {
      void vscode.window.showWarningMessage('Commit Dock: could not open a diff for that file.');
    }
  }
}

export function registerMergeConflictDiffCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.openFirstMergeConflictDiff', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const conflicts = repo.state.mergeChanges;
      if (!conflicts.length) {
        void vscode.window.showInformationMessage('Commit Dock: no merge conflicts in the primary repository.');
        return;
      }
      const first = conflicts[0]!.uri.fsPath;
      await openGitChangeForRepoPath(repo, first);
    }),
  );
}
