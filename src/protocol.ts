/** Protocol version bumped when host↔webview message shapes change. */
export const PROTOCOL_VERSION = 1;

export type HostToWebviewMessage =
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'hello'; payload: { message: string } }
  | { protocolVersion: typeof PROTOCOL_VERSION; type: 'gitStatus'; payload: { ok: boolean; detail?: string } };

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
