import * as vscode from 'vscode';
import { COMMIT_DOCK_CONFIGURATION_SECTION, getCommitViewPlacement } from './config';

/** When `true`, the Commit webview is contributed under the Commit Dock activity bar container. */
export const CONTEXT_SHOW_ACTIVITY_COMMIT_VIEW = 'commitDock:showActivityBarCommitView';

/** When `true`, the Commit webview is contributed under the bottom **Commit Dock** panel container. */
export const CONTEXT_SHOW_PANEL_COMMIT_VIEW = 'commitDock:showPanelCommitView';

export function syncCommitViewPlacementContexts(): void {
  const placement = getCommitViewPlacement();
  void vscode.commands.executeCommand(
    'setContext',
    CONTEXT_SHOW_ACTIVITY_COMMIT_VIEW,
    placement === 'activityBar' || placement === 'both',
  );
  void vscode.commands.executeCommand(
    'setContext',
    CONTEXT_SHOW_PANEL_COMMIT_VIEW,
    placement === 'panel' || placement === 'both',
  );
}

export function registerCommitViewPlacement(context: vscode.ExtensionContext): void {
  syncCommitViewPlacementContexts();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${COMMIT_DOCK_CONFIGURATION_SECTION}.commitViewPlacement`)) {
        syncCommitViewPlacementContexts();
      }
    }),
  );
}

/** Focus the Commit Dock UI using the user’s placement preference. */
export async function focusCommitDockViews(): Promise<void> {
  const placement = getCommitViewPlacement();
  if (placement === 'panel' || placement === 'both') {
    try {
      await vscode.commands.executeCommand('workbench.view.extension.commit-dock-panel');
    } catch {
      // ignore — container may be hidden by VS Code layout
    }
  }
  if (placement === 'activityBar' || placement === 'both') {
    try {
      await vscode.commands.executeCommand('workbench.view.extension.commit-dock');
    } catch {
      // ignore
    }
  }
}
