/** Protocol version bumped when host↔webview message shapes change. */
export const PROTOCOL_VERSION = 10;

export type SnapshotGroupId = 'conflicted' | 'staged' | 'unstaged' | 'untracked';

export interface SnapshotFile {
  /** Absolute path on disk (used later for staging). */
  path: string;
  /** Path relative to workspace folder(s), for display. */
  relPath: string;
  /** Raw `Status` enum value from vscode.git. */
  status: number;
  statusLabel: string;
  group: SnapshotGroupId;
  /** Full codicon class list, e.g. `codicon codicon-diff-modified`. */
  codicon: string;
  /** Whether the file is selected for bulk actions (not in the deselected set). */
  selected: boolean;
}

export interface AmendHeadFileEntry {
  /** Absolute path in the repository. */
  path: string;
  /** Path relative to workspace folders when possible. */
  relPath: string;
}

export interface RepoSnapshot {
  rootPath: string;
  /** Short label for the repository (often a folder name). */
  rootName: string;
  groups: Array<{
    id: SnapshotGroupId;
    title: string;
    files: SnapshotFile[];
  }>;
  /** Absolute paths the user has explicitly unchecked (all others are treated as selected). */
  deselectedPaths: string[];
  updatedAt: number;
  /** Files touched by `HEAD` (amend context; mirrors IntelliJ’s “included in last commit” list). */
  amendHeadFiles?: readonly AmendHeadFileEntry[];
}

/** Stash row for the webview stash panel (from `git stash list`). */
export interface StashSnapshotEntry {
  index: number;
  description: string;
}

export type HostToWebviewMessage =
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'hello'; payload: { message: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'gitStatus'; payload: { ok: boolean; detail?: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'repoSnapshot'; payload: RepoSnapshot }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'commitResult'; payload: { ok: boolean; detail?: string } }
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type: 'headCommitMessage';
      payload: { ok: boolean; message?: string; detail?: string };
    }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'pushResult'; payload: { ok: boolean; detail?: string } }
  | {
      protocolVersion: typeof PROTOCOL_VERSION;
      type: 'stashList';
      payload: { ok: boolean; entries: StashSnapshotEntry[]; detail?: string };
    }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'stashResult'; payload: { ok: boolean; detail?: string } };

export type WebviewToHostMessage =
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'ready' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'noop' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'setPathSelected'; payload: { path: string; selected: boolean } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'setGroupSelection'; payload: { group: SnapshotGroupId; checked: boolean } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'selectAll' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'deselectAll' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'stageSelected' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'unstageSelected' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'discardSelected' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'refreshView' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'quickStash' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'openDiff'; payload: { path: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'commit'; payload: { message: string; amend?: boolean } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'commitAndPush'; payload: { message: string; amend?: boolean } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'requestHeadCommitMessage' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'push'; payload: { forceWithLease?: boolean } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'requestStashList' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'stashApply'; payload: { index: number } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'stashPop'; payload: { index: number } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'stashDrop'; payload: { index: number } };

const GROUP_IDS: ReadonlySet<string> = new Set(['conflicted', 'staged', 'unstaged', 'untracked']);

/** Reject absurd stash indices from the webview (Git stash counts are bounded in practice). */
const MAX_STASH_INDEX = 9_999;

/** Absolute paths from the webview must stay within reasonable length limits. */
const MAX_PATH_CHARS = 8192;

export function parseWebviewMessage(data: unknown): WebviewToHostMessage | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const msg = data as Partial<WebviewToHostMessage>;
  if (msg.protocolVersion !== PROTOCOL_VERSION) {
    return undefined;
  }
  if (typeof msg.type !== 'string') {
    return undefined;
  }

  if (msg.type === 'ready' || msg.type === 'noop') {
    return msg as WebviewToHostMessage;
  }

  if (msg.type === 'selectAll' || msg.type === 'deselectAll') {
    return msg as WebviewToHostMessage;
  }

  if (msg.type === 'stageSelected' || msg.type === 'unstageSelected' || msg.type === 'discardSelected') {
    return msg as WebviewToHostMessage;
  }

  if (msg.type === 'refreshView' || msg.type === 'quickStash') {
    return msg as WebviewToHostMessage;
  }

  if (msg.type === 'openDiff') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const pathStr = (payload as { path?: unknown }).path;
    if (typeof pathStr !== 'string' || pathStr.length === 0 || pathStr.length > MAX_PATH_CHARS || pathStr.includes('\0')) {
      return undefined;
    }
    return { protocolVersion: PROTOCOL_VERSION, type: 'openDiff', payload: { path: pathStr } };
  }

  if (msg.type === 'requestHeadCommitMessage') {
    return msg as WebviewToHostMessage;
  }

  if (msg.type === 'requestStashList') {
    return msg as WebviewToHostMessage;
  }

  if (msg.type === 'stashApply' || msg.type === 'stashPop' || msg.type === 'stashDrop') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const index = (payload as { index?: unknown }).index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > MAX_STASH_INDEX) {
      return undefined;
    }
    return { protocolVersion: PROTOCOL_VERSION, type: msg.type, payload: { index } };
  }

  if (msg.type === 'push') {
    const payload = (msg as { payload?: unknown }).payload;
    let forceWithLease = false;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      forceWithLease = (payload as { forceWithLease?: unknown }).forceWithLease === true;
    }
    return { protocolVersion: PROTOCOL_VERSION, type: 'push', payload: { forceWithLease } };
  }

  if (msg.type === 'commit' || msg.type === 'commitAndPush') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const rawMessage = (payload as { message?: unknown }).message;
    if (typeof rawMessage !== 'string' || rawMessage.length > 200_000) {
      return undefined;
    }
    const amend = (payload as { amend?: unknown }).amend === true;
    const trimmed = rawMessage.trim();
    if (!amend && !trimmed) {
      return undefined;
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      type: msg.type,
      payload: { message: rawMessage, amend },
    };
  }

  if (msg.type === 'setPathSelected') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const path = (payload as { path?: unknown }).path;
    const selected = (payload as { selected?: unknown }).selected;
    if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH_CHARS || path.includes('\0')) {
      return undefined;
    }
    if (typeof selected !== 'boolean') {
      return undefined;
    }
    return { protocolVersion: PROTOCOL_VERSION, type: 'setPathSelected', payload: { path, selected } };
  }

  if (msg.type === 'setGroupSelection') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const group = (payload as { group?: unknown }).group;
    const checked = (payload as { checked?: unknown }).checked;
    if (typeof group !== 'string' || !GROUP_IDS.has(group)) {
      return undefined;
    }
    if (typeof checked !== 'boolean') {
      return undefined;
    }
    if (group === 'conflicted') {
      return undefined;
    }
    return {
      protocolVersion: PROTOCOL_VERSION,
      type: 'setGroupSelection',
      payload: { group: group as SnapshotGroupId, checked },
    };
  }

  return undefined;
}
