import * as vscode from 'vscode';
import { COMMIT_DOCK_CONFIGURATION_SECTION, getCommitViewPlacement } from './config';

/** When `true`, the Commit webview is contributed under the Commit Dock activity bar container. */
export const CONTEXT_SHOW_ACTIVITY_COMMIT_VIEW = 'commitDock:showActivityBarCommitView';

export function syncCommitViewPlacementContexts(): void {
  const placement = getCommitViewPlacement();
  void vscode.commands.executeCommand(
    'setContext',
    CONTEXT_SHOW_ACTIVITY_COMMIT_VIEW,
    placement === 'activityBar' || placement === 'both',
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

/**
 * Ensures the bottom **Commit Dock** panel tab is available (IntelliGit-style dock next to Terminal)
 * and focuses it. If the user previously hid the panel by choosing **activity bar only**, this upgrades
 * the workspace setting to **both** so the panel view is registered again.
 */
export async function openCommitDockBottomPanel(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION);
  const cur = cfg.get<string>('commitViewPlacement');
  if (cur === 'activityBar') {
    await cfg.update('commitViewPlacement', 'both', vscode.ConfigurationTarget.Workspace, false);
    syncCommitViewPlacementContexts();
  }
  try {
    await vscode.commands.executeCommand('workbench.view.extension.commit-dock-panel');
  } catch {
    void vscode.window.showWarningMessage(
      'Commit Dock: could not open the bottom panel. Try **View → Open View… → Commit Dock** or check **commitDock.commitViewPlacement** in Settings.',
    );
  }
}
