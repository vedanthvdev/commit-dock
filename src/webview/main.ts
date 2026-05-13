import { PROTOCOL_VERSION, type HostToWebviewMessage, type RepoSnapshot } from '../protocol';
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

type PersistedUiState = {
  detailsOpen?: Record<string, boolean>;
};

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
    if (msg.type === 'repoSnapshot') {
      renderRepoSnapshot(vscodeApi, msg.payload);
    }
  });
}

function renderRepoSnapshot(
  vscodeApi: NonNullable<ReturnType<NonNullable<Window['acquireVsCodeApi']>>>,
  snapshot: RepoSnapshot,
): void {
  const changes = document.getElementById('changes');
  const repoLine = document.getElementById('repo');
  if (!changes) {
    return;
  }

  changes.hidden = false;
  changes.replaceChildren();

  if (repoLine) {
    if (snapshot.rootName) {
      repoLine.hidden = false;
      repoLine.textContent = `Active repository: ${snapshot.rootName}`;
    } else {
      repoLine.hidden = true;
      repoLine.textContent = '';
    }
  }

  const persisted = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};

  for (const group of snapshot.groups) {
    const details = document.createElement('details');
    details.className = `changes__group changes__group--${group.id}`;

    const summary = document.createElement('summary');
    summary.className = 'changes__summary';
    summary.textContent = `${group.title} (${group.files.length})`;
    details.appendChild(summary);

    const count = group.files.length;
    const persistedOpen = persisted.detailsOpen?.[group.id];
    details.open = persistedOpen !== undefined ? persistedOpen : count > 0;

    details.addEventListener('toggle', () => {
      const prev = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
      const next: PersistedUiState = {
        ...prev,
        detailsOpen: {
          ...(prev.detailsOpen ?? {}),
          [group.id]: details.open,
        },
      };
      vscodeApi.setState(next);
    });

    const list = document.createElement('ul');
    list.className = 'file-list';

    if (count === 0) {
      const empty = document.createElement('li');
      empty.className = 'file-list__empty';
      empty.textContent = 'No files';
      list.appendChild(empty);
    } else {
      for (const file of group.files) {
        const li = document.createElement('li');
        li.className = `file-list__row file-list__row--${group.id}`;

        const icon = document.createElement('span');
        icon.className = file.codicon;
        icon.setAttribute('aria-hidden', 'true');

        const name = document.createElement('span');
        name.className = 'file-list__name';
        name.textContent = file.relPath;

        const meta = document.createElement('span');
        meta.className = 'file-list__meta';
        meta.textContent = file.statusLabel;

        li.append(icon, name, meta);
        list.appendChild(li);
      }
    }

    details.appendChild(list);
    changes.appendChild(details);
  }
}

main();
