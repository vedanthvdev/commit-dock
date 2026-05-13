import * as vscode from 'vscode';
import type { API, GitExtension } from './git-api';

const GIT_EXTENSION_ID = 'vscode.git';

export type GetGitApiOptions = {
  /**
   * When true, do not show notifications for missing/disabled Git (used when
   * refreshing the webview so we do not spam the user on every visibility change).
   */
  silent?: boolean;
};

/**
 * Returns the Git extension API, or `undefined` if Git is missing or disabled.
 * Waits (briefly) for `api.state === 'initialized'` so `repositories` is populated.
 */
export async function getGitApi(options?: GetGitApiOptions): Promise<API | undefined> {
  const silent = options?.silent ?? false;
  const ext = vscode.extensions.getExtension<GitExtension>(GIT_EXTENSION_ID);
  if (!ext) {
    if (!silent) {
      void vscode.window.showErrorMessage(
        'Commit Dock: built-in Git extension (vscode.git) is not available.',
      );
    }
    return undefined;
  }

  if (!ext.isActive) {
    await ext.activate();
  }

  if (!ext.exports.enabled) {
    if (!silent) {
      void vscode.window.showWarningMessage(
        'Commit Dock: Git is disabled in VS Code settings. Enable the Git extension to use Commit Dock.',
      );
    }
    return undefined;
  }

  const api = ext.exports.getAPI(1);
  if (api.state === 'initialized') {
    return api;
  }

  await new Promise<void>((resolve) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let sub: vscode.Disposable | undefined;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      sub?.dispose();
      resolve();
    };

    sub = api.onDidChangeState((s) => {
      if (s === 'initialized') {
        finish();
      }
    });

    timeout = setTimeout(() => {
      if (!silent) {
        void vscode.window.showWarningMessage(
          'Commit Dock: Git API is slow to initialize. Repository list may be empty until Git finishes loading.',
        );
      }
      finish();
    }, 15_000);

    if (api.state === 'initialized') {
      finish();
    }
  });

  return api;
}
