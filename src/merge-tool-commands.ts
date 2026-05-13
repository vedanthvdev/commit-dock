import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getExternalMergeToolPath } from './config';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

function resolveMergeToolExecutable(raw: string): string | undefined {
  const t = raw.trim();
  if (!t || t.includes('\0')) {
    return undefined;
  }
  if (process.platform === 'darwin' && t.toLowerCase().endsWith('.app')) {
    const base = path.basename(t, '.app');
    const primary = path.join(t, 'Contents', 'MacOS', base);
    if (fs.existsSync(primary)) {
      return primary;
    }
    const macosDir = path.join(t, 'Contents', 'MacOS');
    try {
      if (fs.existsSync(macosDir) && fs.statSync(macosDir).isDirectory()) {
        const entries = fs.readdirSync(macosDir).filter((e) => !e.startsWith('.'));
        if (entries.length === 1) {
          return path.join(macosDir, entries[0]!);
        }
      }
    } catch {
      return undefined;
    }
  }
  return fs.existsSync(t) ? t : undefined;
}

export function registerMergeToolCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.openExternalMergeTool', async () => {
      const configured = getExternalMergeToolPath();
      if (!configured) {
        void vscode.window.showWarningMessage(
          'Commit Dock: set **commitDock.externalMergeToolPath** to your merge tool executable or macOS `.app` (see README).',
        );
        return;
      }
      const exe = resolveMergeToolExecutable(configured);
      if (!exe) {
        void vscode.window.showErrorMessage('Commit Dock: merge tool path was not found on disk.');
        return;
      }
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
      const items = conflicts.map((c) => {
        const rel = vscode.workspace.asRelativePath(c.uri, false) || c.uri.fsPath;
        return { label: rel, description: c.uri.fsPath, path: c.uri.fsPath };
      });
      const picked =
        items.length === 1
          ? items[0]
          : await vscode.window.showQuickPick(items, { title: 'Open merge conflict in external tool' });
      if (!picked) {
        return;
      }
      if (!fs.existsSync(picked.path)) {
        void vscode.window.showErrorMessage('Commit Dock: conflict path is not on disk.');
        return;
      }
      try {
        const child = spawn(exe, [picked.path], {
          cwd: repo.rootUri.fsPath,
          detached: true,
          stdio: 'ignore',
        });
        child.on('error', (err) => {
          void vscode.window.showErrorMessage(`Commit Dock: could not start merge tool — ${err.message}`);
        });
        child.unref();
        void vscode.window.showInformationMessage('Commit Dock: launched external merge tool.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: could not start merge tool — ${msg}`);
      }
    }),
  );
}
