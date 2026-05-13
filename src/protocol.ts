/** Protocol version bumped when host↔webview message shapes change. */
export const PROTOCOL_VERSION = 5;

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
}

export type HostToWebviewMessage =
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'hello'; payload: { message: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'gitStatus'; payload: { ok: boolean; detail?: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'repoSnapshot'; payload: RepoSnapshot }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'commitResult'; payload: { ok: boolean; detail?: string } };

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
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'commit'; payload: { message: string } };

const GROUP_IDS: ReadonlySet<string> = new Set(['conflicted', 'staged', 'unstaged', 'untracked']);

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

  if (msg.type === 'commit') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message !== 'string' || message.length > 200_000) {
      return undefined;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      return undefined;
    }
    return { protocolVersion: PROTOCOL_VERSION, type: 'commit', payload: { message: trimmed } };
  }

  if (msg.type === 'setPathSelected') {
    const payload = (msg as { payload?: unknown }).payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }
    const path = (payload as { path?: unknown }).path;
    const selected = (payload as { selected?: unknown }).selected;
    if (typeof path !== 'string' || path.length === 0) {
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
