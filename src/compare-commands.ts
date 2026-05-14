import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { gitExecFileBase } from './git/git-exec';
import { getGitApi } from './git/api';
import { pickPrimaryRepository } from './git/snapshot';

const execFileAsync = promisify(execFile);

const MAX_REF_LEN = 200;
const MAX_OUT_CHARS = 400_000;

function isSafeGitRefToken(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > MAX_REF_LEN || t.includes('\0') || t.includes('..')) {
    return false;
  }
  return /^[\w./+@:-]+$/.test(t);
}

export function registerCompareCommands(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel('Commit Dock: Compare');
  context.subscriptions.push(channel);

  context.subscriptions.push(
    vscode.commands.registerCommand('commitDock.compareWorkingTreeWithRef', async () => {
      const api = await getGitApi({ silent: true });
      const repo = api ? pickPrimaryRepository(api) : undefined;
      if (!repo) {
        void vscode.window.showWarningMessage('Commit Dock: no Git repository is active.');
        return;
      }
      const root = repo.rootUri.fsPath;
      const ref = await vscode.window.showInputBox({
        title: 'Compare with ref',
        prompt: 'Enter a branch or tag (example: main, origin/main)',
        validateInput: (v) => {
          if (!v.trim()) {
            return 'Enter a ref.';
          }
          if (!isSafeGitRefToken(v)) {
            return 'Use a ref without spaces or .. sequences (letters, numbers, /, ., _, +, @, :, -).';
          }
          return undefined;
        },
      });
      if (!ref) {
        return;
      }
      const token = ref.trim();
      const range = `${token}...HEAD`;
      try {
        const { stdout, stderr } = await execFileAsync(
          'git',
          ['-c', 'core.pager=cat', 'diff', '--name-status', range],
          {
            cwd: root,
            maxBuffer: 4_000_000,
            ...gitExecFileBase,
          },
        );
        const combined = `${stdout}${stderr}`.trimEnd();
        const capped =
          combined.length > MAX_OUT_CHARS ? `${combined.slice(0, MAX_OUT_CHARS)}\n… (truncated)` : combined;
        channel.clear();
        channel.appendLine(`git diff --name-status ${range}`);
        channel.appendLine('');
        channel.appendLine(capped.length ? capped : '(no differences)');
        channel.show(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        void vscode.window.showErrorMessage(`Commit Dock: compare failed — ${msg}`);
      }
    }),
  );
}
