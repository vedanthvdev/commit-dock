import * as vscode from 'vscode';

export const COMMIT_DOCK_CONFIGURATION_SECTION = 'commitDock';

/** Debounce for Git `onDidChange` snapshot refresh (ms). */
export function getSnapshotDebounceMs(): number {
  const raw = vscode.workspace
    .getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION)
    .get<number>('snapshotDebounceMs', 150);
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 150;
  return Math.max(0, Math.min(2000, n));
}

/** When false, discard runs without a confirmation modal. */
export function getConfirmBeforeDiscard(): boolean {
  const v = vscode.workspace
    .getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION)
    .get<boolean>('confirmBeforeDiscard');
  return v !== false;
}

/** When true, show pending change count on the Commit Dock activity bar icon. */
export function getShowActivityBarBadge(): boolean {
  const v = vscode.workspace
    .getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION)
    .get<boolean>('showActivityBarBadge');
  return v !== false;
}

/** When false, hide the Commit and Push control in the webview (commit and push remain separate). */
export function getShowCommitAndPushButton(): boolean {
  const v = vscode.workspace
    .getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION)
    .get<boolean>('showCommitAndPushButton');
  return v !== false;
}

/** Optional path to an external merge tool executable or macOS `.app` bundle (user-provided). */
export function getExternalMergeToolPath(): string {
  const v = vscode.workspace.getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION).get<string>('externalMergeToolPath');
  return typeof v === 'string' ? v.trim() : '';
}

/** What **Copy HEAD Revision** places on the clipboard: full 40‑char SHA or a 7‑char short SHA. */
export function getCopyHeadRevisionFormat(): 'full' | 'short' {
  const v = vscode.workspace.getConfiguration(COMMIT_DOCK_CONFIGURATION_SECTION).get<string>('copyHeadRevisionFormat');
  return v === 'short' ? 'short' : 'full';
}
