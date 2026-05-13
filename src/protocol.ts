/** Protocol version bumped when host↔webview message shapes change. */
export const PROTOCOL_VERSION = 2;

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
  updatedAt: number;
}

export type HostToWebviewMessage =
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'hello'; payload: { message: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'gitStatus'; payload: { ok: boolean; detail?: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'repoSnapshot'; payload: RepoSnapshot };

export type WebviewToHostMessage =
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'ready' }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'noop' };

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
  return undefined;
}
