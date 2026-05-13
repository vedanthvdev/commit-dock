import { describe, expect, it } from 'vitest';
import { Status, type Change, type Repository } from './git-api';
import { countWorkspaceChangePaths } from './repo-change-model';

function fileUri(fsPath: string): Change['uri'] {
  return { fsPath, scheme: 'file', path: fsPath } as Change['uri'];
}

function change(fsPath: string, status: Status): Change {
  const uri = fileUri(fsPath);
  return { uri, originalUri: uri, renameUri: undefined, status };
}

function noopEvent(): Repository['state']['onDidChange'] {
  return () => ({ dispose() {} });
}

function makeRepo(partial: {
  mergeChanges?: Change[];
  indexChanges?: Change[];
  workingTreeChanges?: Change[];
  untrackedChanges?: Change[];
}): Repository {
  const rootUri = fileUri('/repo') as Repository['rootUri'];
  return {
    rootUri,
    state: {
      HEAD: undefined,
      mergeChanges: partial.mergeChanges ?? [],
      indexChanges: partial.indexChanges ?? [],
      workingTreeChanges: partial.workingTreeChanges ?? [],
      untrackedChanges: partial.untrackedChanges ?? [],
      onDidChange: noopEvent(),
    },
    onDidCommit: noopEvent(),
    getCommit: async () => ({ hash: '', message: '', parents: [] }),
    add: async () => {},
    revert: async () => {},
    clean: async () => {},
    restore: async () => {},
    commit: async () => {},
    push: async () => {},
    applyStash: async () => {},
    popStash: async () => {},
    dropStash: async () => {},
    createStash: async () => {},
    isBranchProtected: () => false,
  };
}

describe('countWorkspaceChangePaths', () => {
  it('counts distinct paths across merge, index, working tree, and untracked', () => {
    const repo = makeRepo({
      mergeChanges: [change('/repo/a.txt', Status.BOTH_MODIFIED)],
      indexChanges: [change('/repo/b.txt', Status.INDEX_MODIFIED)],
      workingTreeChanges: [change('/repo/c.txt', Status.MODIFIED)],
      untrackedChanges: [change('/repo/d.txt', Status.UNTRACKED)],
    });
    expect(countWorkspaceChangePaths(repo)).toBe(4);
  });

  it('dedupes the same path in index and working tree', () => {
    const p = '/repo/same.txt';
    const repo = makeRepo({
      indexChanges: [change(p, Status.INDEX_MODIFIED)],
      workingTreeChanges: [change(p, Status.MODIFIED)],
    });
    expect(countWorkspaceChangePaths(repo)).toBe(1);
  });

  it('treats UNTRACKED in workingTreeChanges like merged untracked without double counting untrackedChanges', () => {
    const p = '/repo/u.txt';
    const repo = makeRepo({
      workingTreeChanges: [change(p, Status.UNTRACKED)],
      untrackedChanges: [change(p, Status.UNTRACKED)],
    });
    expect(countWorkspaceChangePaths(repo)).toBe(1);
  });
});
