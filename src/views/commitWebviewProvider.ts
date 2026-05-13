import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getGitApi } from '../git/api';
import { PROTOCOL_VERSION, parseWebviewMessage, type HostToWebviewMessage } from '../protocol';

export class CommitWebviewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'commitDock.commitView';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')],
    };

    const nonce = getNonce();
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, nonce);

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      webviewView.webview.onDidReceiveMessage(async (data: unknown) => {
        const msg = parseWebviewMessage(data);
        if (!msg) {
          return;
        }
        if (msg.type === 'ready') {
          await this._pushInitialState();
        }
      }),
    );

    disposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          void this._pushInitialState();
        }
      }),
    );

    webviewView.onDidDispose(() => {
      vscode.Disposable.from(...disposables).dispose();
      if (this._view === webviewView) {
        this._view = undefined;
      }
    });
  }

  private async _pushInitialState(): Promise<void> {
    const view = this._view;
    if (!view) {
      return;
    }

    const hello: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'hello',
      payload: { message: 'Commit Dock' },
    };
    void view.webview.postMessage(hello);

    const api = await getGitApi({ silent: true });

    let ok: boolean;
    let detail: string;
    if (!api) {
      ok = false;
      detail =
        'Built-in Git is unavailable or disabled. Enable the Git extension in VS Code settings.';
    } else if (api.repositories.length === 0) {
      ok = false;
      detail = 'Open a folder that contains a Git repository.';
    } else {
      ok = true;
      const n = api.repositories.length;
      detail = `${n} Git repositor${n === 1 ? 'y' : 'ies'} detected.`;
    }

    const gitStatus: HostToWebviewMessage = {
      protocolVersion: PROTOCOL_VERSION,
      type: 'gitStatus',
      payload: { ok, detail },
    };
    void view.webview.postMessage(gitStatus);
  }

  private _getHtmlForWebview(webview: vscode.Webview, nonce: string): string {
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} https: data:`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'main.css'));
    const codiconsFsPath = path.join(this._extensionUri.fsPath, 'dist', 'webview', 'codicons', 'codicon.css');
    const codiconsCss = fs.existsSync(codiconsFsPath)
      ? webview.asWebviewUri(vscode.Uri.file(codiconsFsPath)).toString()
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  ${codiconsCss ? `<link href="${codiconsCss}" rel="stylesheet" nonce="${nonce}" />` : ''}
  <link href="${styleUri}" rel="stylesheet" nonce="${nonce}" />
  <title>Commit Dock</title>
</head>
<body>
  <div id="app" class="app">
    <header class="header">
      <span class="codicon codicon-git-commit"></span>
      <span id="title">Commit Dock</span>
    </header>
    <main class="main">
      <p id="status" class="status">Loading…</p>
      <p class="hint">Phase 0 scaffold — file list, commit, amend, stash, and push will land in subsequent releases per CHANGELOG.</p>
    </main>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return randomBytes(16).toString('hex');
}
