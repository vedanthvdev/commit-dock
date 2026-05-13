import * as vscode from 'vscode';
import type { API, Change, Repository } from './git-api';
import { Status } from './git-api';
import type { RepoSnapshot, SnapshotFile, SnapshotGroupId } from '../protocol';

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

export function getSelectablePathsForGroup(repo: Repository, group: SnapshotGroupId): string[] {
  switch (group) {
    case 'conflicted':
      return [];
    case 'staged':
      return repo.state.indexChanges.map((c) => c.uri.fsPath);
    case 'unstaged':
      return repo.state.workingTreeChanges.map((c) => c.uri.fsPath);
    case 'untracked':
      return repo.state.untrackedChanges.map((c) => c.uri.fsPath);
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
      return 'Untracked';
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
    codicon: codiconForStatus(group, change.status),
    selected: !deselected.has(path),
  };
}

export function buildRepoSnapshot(repo: Repository, deselected: ReadonlySet<string>): RepoSnapshot {
  const rootPath = repo.rootUri.fsPath;
  const rootName = vscode.workspace.asRelativePath(repo.rootUri, true) || repo.rootUri.fsPath;

  const conflicted: SnapshotFile[] = repo.state.mergeChanges.map((c) =>
    toFile(rootPath, 'conflicted', c, deselected),
  );
  const staged: SnapshotFile[] = repo.state.indexChanges.map((c) => toFile(rootPath, 'staged', c, deselected));
  const unstaged: SnapshotFile[] = repo.state.workingTreeChanges.map((c) =>
    toFile(rootPath, 'unstaged', c, deselected),
  );
  const untracked: SnapshotFile[] = repo.state.untrackedChanges.map((c) =>
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
    groups: [
      { id: 'conflicted', title: 'Merge conflicts', files: conflicted },
      { id: 'staged', title: 'Staged', files: staged },
      { id: 'unstaged', title: 'Changes', files: unstaged },
      { id: 'untracked', title: 'Untracked', files: untracked },
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
    groups: [
      { id: 'conflicted', title: 'Merge conflicts', files: [] },
      { id: 'staged', title: 'Staged', files: [] },
      { id: 'unstaged', title: 'Changes', files: [] },
      { id: 'untracked', title: 'Untracked', files: [] },
    ],
    deselectedPaths: [],
    updatedAt: Date.now(),
  };
}
