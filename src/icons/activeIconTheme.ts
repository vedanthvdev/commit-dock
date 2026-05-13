import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type ActiveFileIconTheme = {
  /** Extension root that owns the icon theme (used for webview `localResourceRoots`). */
  extensionUri: vscode.Uri;
  /** Absolute URI to the `*icon-theme.json` file. */
  themeJsonUri: vscode.Uri;
};

/**
 * Resolve the currently configured File Icon Theme to the contributing extension + JSON path.
 * When `workbench.iconTheme` is unset, VS Code defaults to `vs-seti`.
 */
export function getActiveFileIconTheme(): ActiveFileIconTheme | undefined {
  const configured = vscode.workspace.getConfiguration('workbench').get<string | null>('iconTheme');
  const themeId = configured?.trim() ? configured.trim() : 'vs-seti';

  for (const ext of vscode.extensions.all) {
    const pkg = ext.packageJSON as { contributes?: { iconThemes?: Array<{ id?: string; path?: string }> } } | undefined;
    const list = pkg?.contributes?.iconThemes;
    if (!Array.isArray(list)) {
      continue;
    }
    for (const t of list) {
      if (t?.id === themeId && typeof t.path === 'string') {
        return {
          extensionUri: ext.extensionUri,
          themeJsonUri: vscode.Uri.joinPath(ext.extensionUri, t.path),
        };
      }
    }
  }

  // Fallback: built-in Seti shipped with VS Code / Cursor (before extensions are enumerated).
  const jsonFsPath = path.join(vscode.env.appRoot, 'extensions', 'theme-seti', 'icons', 'vs-seti-icon-theme.json');
  if (!fs.existsSync(jsonFsPath)) {
    return undefined;
  }
  const themeJsonUri = vscode.Uri.file(jsonFsPath);
  const extensionUri = vscode.Uri.file(path.join(vscode.env.appRoot, 'extensions', 'theme-seti'));
  return { extensionUri, themeJsonUri };
}
