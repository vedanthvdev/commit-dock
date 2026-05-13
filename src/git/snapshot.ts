import * as vscode from 'vscode';
import type { API, Branch, Change, Repository } from './git-api';
import { Status } from './git-api';
import type { RepoSnapshot, SnapshotFile, SnapshotGroupId } from '../protocol';
import { fileCodiconFromPath } from './file-codicons';
import { mergedUntrackedChanges, unstagedWorkingTreeChanges } from './repo-change-model';

export function pickPrimaryRepository(api: API): Repository | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.uri) {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) {
      const byFolder = api.getRepository(folder.uri);
      if (byFolder) {
        return byFolder;
      }
    }
    const byDoc = api.getRepository(editor.document.uri);
    if (byDoc) {
      return byDoc;
    }
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    const byFirst = api.getRepository(folders[0].uri);
    if (byFirst) {
      return byFirst;
    }
  }

  return api.repositories[0];
}

/** Paths Git treats as untracked / unversioned (matches IntelliJ’s split better than raw `untrackedChanges` alone). */
export function untrackedPathSet(repo: Repository): Set<string> {
  return new Set(mergedUntrackedChanges(repo).map((c) => c.uri.fsPath));
}

/** Working-tree paths that are staged changes vs untracked/unversioned. */
export function unstagedWorkingPathSet(repo: Repository): Set<string> {
  return new Set(unstagedWorkingTreeChanges(repo).map((c) => c.uri.fsPath));
}

export function getSelectablePathsForGroup(repo: Repository, group: SnapshotGroupId): string[] {
  switch (group) {
    case 'conflicted':
      return [];
    case 'staged':
      return repo.state.indexChanges.map((c) => c.uri.fsPath);
    case 'unstaged':
      return unstagedWorkingTreeChanges(repo).map((c) => c.uri.fsPath);
    case 'untracked':
      return mergedUntrackedChanges(repo).map((c) => c.uri.fsPath);
    default:
      return [];
  }
}

export function getAllSelectablePaths(repo: Repository): string[] {
  return [
    ...getSelectablePathsForGroup(repo, 'staged'),
    ...getSelectablePathsForGroup(repo, 'unstaged'),
    ...getSelectablePathsForGroup(repo, 'untracked'),
  ];
}

/** Paths that are both selectable and not in the deselected set. */
export function getSelectedSelectablePaths(repo: Repository, deselected: ReadonlySet<string>): string[] {
  return getAllSelectablePaths(repo).filter((p) => !deselected.has(p));
}

/** Selected paths that can be staged (working tree or untracked). */
export function pathsToStage(repo: Repository, selectedPaths: readonly string[]): string[] {
  const unstaged = unstagedWorkingPathSet(repo);
  const untracked = untrackedPathSet(repo);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of selectedPaths) {
    if (seen.has(p)) {
      continue;
    }
    if (!unstaged.has(p) && !untracked.has(p)) {
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** Selected paths that are currently staged (in the index). */
export function pathsToUnstage(repo: Repository, selectedPaths: readonly string[]): string[] {
  const staged = new Set(repo.state.indexChanges.map((c) => c.uri.fsPath));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of selectedPaths) {
    if (seen.has(p)) {
      continue;
    }
    if (!staged.has(p)) {
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** Staged paths the user explicitly deselected (excluded from the next commit until restaged). */
export function pathsStagedAndDeselected(repo: Repository, deselected: ReadonlySet<string>): string[] {
  return repo.state.indexChanges.map((c) => c.uri.fsPath).filter((p) => deselected.has(p));
}

export type DiscardPartition = { clean: string[]; restore: string[] };

/** Selected paths that can be discarded from working tree / untracked (never staged-only). */
export function pathsToDiscard(repo: Repository, selectedPaths: readonly string[]): DiscardPartition {
  const untracked = untrackedPathSet(repo);
  const working = unstagedWorkingPathSet(repo);
  const clean: string[] = [];
  const restore: string[] = [];
  const seenClean = new Set<string>();
  const seenRestore = new Set<string>();
  for (const p of selectedPaths) {
    if (untracked.has(p)) {
      if (!seenClean.has(p)) {
        seenClean.add(p);
        clean.push(p);
      }
      continue;
    }
    if (working.has(p) && !seenRestore.has(p)) {
      seenRestore.add(p);
      restore.push(p);
    }
  }
  return { clean, restore };
}

function statusLabel(status: Status): string {
  switch (status) {
    case Status.INDEX_MODIFIED:
      return 'Staged (modified)';
    case Status.INDEX_ADDED:
      return 'Staged (added)';
    case Status.INDEX_DELETED:
      return 'Staged (deleted)';
    case Status.INDEX_RENAMED:
      return 'Staged (renamed)';
    case Status.INDEX_COPIED:
      return 'Staged (copied)';
    case Status.MODIFIED:
      return 'Modified';
    case Status.DELETED:
      return 'Deleted';
    case Status.UNTRACKED:
      return 'Unversioned';
    case Status.IGNORED:
      return 'Ignored';
    case Status.INTENT_TO_ADD:
      return 'Intent to add';
    case Status.INTENT_TO_RENAME:
      return 'Intent to rename';
    case Status.TYPE_CHANGED:
      return 'Type changed';
    case Status.ADDED_BY_US:
      return 'Added by us';
    case Status.ADDED_BY_THEM:
      return 'Added by them';
    case Status.DELETED_BY_US:
      return 'Deleted by us';
    case Status.DELETED_BY_THEM:
      return 'Deleted by them';
    case Status.BOTH_ADDED:
      return 'Both added';
    case Status.BOTH_DELETED:
      return 'Both deleted';
    case Status.BOTH_MODIFIED:
      return 'Both modified';
    default:
      return 'Changed';
  }
}

function codiconForStatus(group: SnapshotGroupId, status: Status): string {
  if (group === 'conflicted') {
    return 'codicon codicon-git-merge';
  }
  switch (status) {
    case Status.INDEX_ADDED:
    case Status.ADDED_BY_US:
    case Status.ADDED_BY_THEM:
    case Status.BOTH_ADDED:
      return 'codicon codicon-diff-added';
    case Status.INDEX_DELETED:
    case Status.DELETED:
    case Status.DELETED_BY_US:
    case Status.DELETED_BY_THEM:
    case Status.BOTH_DELETED:
      return 'codicon codicon-diff-removed';
    case Status.UNTRACKED:
      return 'codicon codicon-new-file';
    default:
      return 'codicon codicon-diff-modified';
  }
}

function toFile(
  _repoRoot: string,
  group: SnapshotGroupId,
  change: Change,
  deselected: ReadonlySet<string>,
): SnapshotFile {
  const uri = change.uri;
  const path = uri.fsPath;
  const relPath = vscode.workspace.asRelativePath(uri, true);
  return {
    path,
    relPath: relPath || path,
    status: change.status,
    statusLabel: statusLabel(change.status),
    group,
    fileIcon: { kind: 'codicon', classes: fileCodiconFromPath(path) },
    codicon: codiconForStatus(group, change.status),
    selected: !deselected.has(path),
  };
}

function headDisplayLabel(head: Branch | undefined): string | undefined {
  if (!head?.commit) {
    return undefined;
  }
  const base = head.name ? head.name : `detached @ ${head.commit.slice(0, 7)}`;
  const a = head.ahead;
  const b = head.behind;
  const hasA = typeof a === 'number' && a > 0;
  const hasB = typeof b === 'number' && b > 0;
  if (hasA || hasB) {
    const bits: string[] = [];
    if (hasA) {
      bits.push(`↑${a}`);
    }
    if (hasB) {
      bits.push(`↓${b}`);
    }
    return `${base} ${bits.join(' ')}`;
  }
  return base;
}

export function buildRepoSnapshot(repo: Repository, deselected: ReadonlySet<string>): RepoSnapshot {
  const rootPath = repo.rootUri.fsPath;
  const rootName = vscode.workspace.asRelativePath(repo.rootUri, true) || repo.rootUri.fsPath;

  const conflicted: SnapshotFile[] = repo.state.mergeChanges.map((c) =>
    toFile(rootPath, 'conflicted', c, deselected),
  );
  const staged: SnapshotFile[] = repo.state.indexChanges.map((c) => toFile(rootPath, 'staged', c, deselected));
  const unstaged: SnapshotFile[] = unstagedWorkingTreeChanges(repo).map((c) =>
    toFile(rootPath, 'unstaged', c, deselected),
  );
  const untracked: SnapshotFile[] = mergedUntrackedChanges(repo).map((c) =>
    toFile(rootPath, 'untracked', c, deselected),
  );

  const sortByPath = (a: SnapshotFile, b: SnapshotFile) => a.relPath.localeCompare(b.relPath);
  conflicted.sort(sortByPath);
  staged.sort(sortByPath);
  unstaged.sort(sortByPath);
  untracked.sort(sortByPath);

  const selectable = new Set(getAllSelectablePaths(repo));
  const deselectedPaths = [...deselected].filter((p) => selectable.has(p)).sort();

  return {
    rootPath,
    rootName,
    headLabel: headDisplayLabel(repo.state.HEAD),
    groups: [
      { id: 'conflicted', title: 'Merge conflicts', files: conflicted },
      { id: 'staged', title: 'Staged', files: staged },
      { id: 'unstaged', title: 'Unstaged', files: unstaged },
      { id: 'untracked', title: 'Unversioned files', files: untracked },
    ],
    deselectedPaths,
    updatedAt: Date.now(),
  };
}

export function emptyRepoSnapshot(rootHint?: string): RepoSnapshot {
  const rootPath = rootHint ?? '';
  const rootName = rootHint ? vscode.workspace.asRelativePath(vscode.Uri.file(rootHint), true) || rootHint : '';
  return {
    rootPath,
    rootName,
    headLabel: undefined,
    groups: [
      { id: 'conflicted', title: 'Merge conflicts', files: [] },
      { id: 'staged', title: 'Staged', files: [] },
      { id: 'unstaged', title: 'Unstaged', files: [] },
      { id: 'untracked', title: 'Unversioned files', files: [] },
    ],
    deselectedPaths: [],
    updatedAt: Date.now(),
  };
}
