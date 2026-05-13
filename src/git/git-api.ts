/**
 * Subset of the built-in Git extension API (vscode.git).
 * Full reference: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
 */
import type { Event, Uri } from 'vscode';

export const enum ForcePushMode {
  Force = 0,
  ForceWithLease = 1,
  ForceWithLeaseIfIncludes = 2,
}

export const enum Status {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  INDEX_RENAMED,
  INDEX_COPIED,
  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED,
  INTENT_TO_ADD,
  INTENT_TO_RENAME,
  TYPE_CHANGED,
  ADDED_BY_US,
  ADDED_BY_THEM,
  DELETED_BY_US,
  DELETED_BY_THEM,
  BOTH_ADDED,
  BOTH_DELETED,
  BOTH_MODIFIED,
}

export interface Change {
  readonly uri: Uri;
  readonly originalUri: Uri;
  readonly renameUri: Uri | undefined;
  readonly status: Status;
}

export interface Commit {
  readonly hash: string;
  readonly message: string;
  readonly parents: string[];
}

export interface UpstreamRef {
  readonly remote: string;
  readonly name: string;
  readonly commit?: string;
}

export const enum RefType {
  Head,
  RemoteHead,
  Tag,
}

export interface Ref {
  readonly type: RefType;
  readonly name?: string;
  readonly commit?: string;
}

export interface Branch extends Ref {
  readonly upstream?: UpstreamRef;
  readonly ahead?: number;
  readonly behind?: number;
}

export interface RepositoryState {
  readonly HEAD: Branch | undefined;
  readonly mergeChanges: Change[];
  readonly indexChanges: Change[];
  readonly workingTreeChanges: Change[];
  readonly untrackedChanges: Change[];
  readonly onDidChange: Event<void>;
}

export interface CommitOptions {
  all?: boolean | 'tracked';
  amend?: boolean;
  signoff?: boolean;
  signCommit?: boolean;
  empty?: boolean;
  noVerify?: boolean;
  requireUserConfig?: boolean;
  useEditor?: boolean;
  verbose?: boolean;
  postCommitCommand?: string | null;
}

export interface Repository {
  readonly rootUri: Uri;
  readonly state: RepositoryState;
  readonly onDidCommit: Event<void>;
  getCommit(ref: string): Promise<Commit>;
  add(paths: string[]): Promise<void>;
  /** Unstage paths (remove from index) while keeping working tree content. */
  revert(paths: string[]): Promise<void>;
  /** Remove untracked paths (destructive). */
  clean(paths: string[]): Promise<void>;
  /** Restore working tree or index from HEAD / index (matches `git restore`). */
  restore(paths: string[], options?: { staged?: boolean; ref?: string }): Promise<void>;
  commit(message: string, opts?: CommitOptions): Promise<void>;
  push(
    remoteName?: string,
    branchName?: string,
    setUpstream?: boolean,
    force?: ForcePushMode,
  ): Promise<void>;
  applyStash(index?: number): Promise<void>;
  popStash(index?: number): Promise<void>;
  dropStash(index?: number): Promise<void>;
  createStash(options?: { message?: string; includeUntracked?: boolean; staged?: boolean }): Promise<void>;
  isBranchProtected(branch?: Branch): boolean;
}

export type APIState = 'uninitialized' | 'initialized';

export interface API {
  readonly state: APIState;
  readonly onDidChangeState: Event<APIState>;
  readonly repositories: Repository[];
  readonly onDidOpenRepository: Event<Repository>;
  readonly onDidCloseRepository: Event<Repository>;
  getRepository(uri: Uri): Repository | null;
}

export interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;
  getAPI(version: 1): API;
}
