import type { Change, Repository } from './git-api';
import { Status } from './git-api';

/** VS Code sometimes reports `Status.UNTRACKED` under `workingTreeChanges`; IntelliJ shows those as unversioned. */
export function isUntrackedWorkingTreeChange(c: Change): boolean {
  return c.status === Status.UNTRACKED;
}

export function unstagedWorkingTreeChanges(repo: Repository): Change[] {
  return repo.state.workingTreeChanges.filter((c) => !isUntrackedWorkingTreeChange(c));
}

export function mergedUntrackedChanges(repo: Repository): Change[] {
  const byPath = new Map<string, Change>();
  for (const c of repo.state.untrackedChanges) {
    byPath.set(c.uri.fsPath, c);
  }
  for (const c of repo.state.workingTreeChanges) {
    if (isUntrackedWorkingTreeChange(c)) {
      byPath.set(c.uri.fsPath, c);
    }
  }
  return [...byPath.values()];
}

/** Unique paths with pending work in the repo (matches rows shown across Commit Dock groups). */
export function countWorkspaceChangePaths(repo: Repository): number {
  const paths = new Set<string>();
  for (const c of repo.state.mergeChanges) {
    paths.add(c.uri.fsPath);
  }
  for (const c of repo.state.indexChanges) {
    paths.add(c.uri.fsPath);
  }
  for (const c of unstagedWorkingTreeChanges(repo)) {
    paths.add(c.uri.fsPath);
  }
  for (const c of mergedUntrackedChanges(repo)) {
    paths.add(c.uri.fsPath);
  }
  return paths.size;
}
