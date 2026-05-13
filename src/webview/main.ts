import { PROTOCOL_VERSION, type HostToWebviewMessage } from '../protocol';
import './styles.css';

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (msg: unknown) => void;
      getState: () => unknown;
      setState: (s: unknown) => void;
    };
  }
}

function main(): void {
  const vscodeApi = window.acquireVsCodeApi?.();
  if (!vscodeApi) {
    return;
  }

  vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'ready' });

  window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
    const msg = event.data;
    if (!msg || msg.protocolVersion !== PROTOCOL_VERSION) {
      return;
    }
    if (msg.type === 'hello') {
      const title = document.getElementById('title');
      if (title) {
        title.textContent = msg.payload.message;
      }
    }
    if (msg.type === 'gitStatus') {
      const status = document.getElementById('status');
      if (status) {
        status.textContent = msg.payload.detail ?? (msg.payload.ok ? 'Git ready.' : 'No Git repository.');
      }
    }
  });
}

main();
