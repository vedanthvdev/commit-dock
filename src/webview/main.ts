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

function wireSelectionToolbar(
  vscodeApi: NonNullable<ReturnType<NonNullable<Window['acquireVsCodeApi']>>>,
  toolbar: HTMLElement,
): void {
  toolbar.replaceChildren();

  const selectAll = document.createElement('button');
  selectAll.type = 'button';
  selectAll.className = 'selection-toolbar__btn';
  selectAll.textContent = 'Select all';
  selectAll.addEventListener('click', () => {
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'selectAll' });
  });

  const deselectAll = document.createElement('button');
  deselectAll.type = 'button';
  deselectAll.className = 'selection-toolbar__btn';
  deselectAll.textContent = 'Deselect all';
  deselectAll.addEventListener('click', () => {
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'deselectAll' });
  });

  const stage = document.createElement('button');
  stage.type = 'button';
  stage.className = 'selection-toolbar__btn';
  stage.textContent = 'Stage';
  stage.title = 'Stage selected changes and untracked files';
  stage.addEventListener('click', () => {
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'stageSelected' });
  });

  const unstage = document.createElement('button');
  unstage.type = 'button';
  unstage.className = 'selection-toolbar__btn';
  unstage.textContent = 'Unstage';
  unstage.title = 'Remove selected files from the index';
  unstage.addEventListener('click', () => {
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'unstageSelected' });
  });

  const discard = document.createElement('button');
  discard.type = 'button';
  discard.className = 'selection-toolbar__btn selection-toolbar__btn--danger';
  discard.textContent = 'Discard';
  discard.title = 'Delete selected untracked files and revert working tree changes';
  discard.addEventListener('click', () => {
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'discardSelected' });
  });

  toolbar.append(selectAll, deselectAll, stage, unstage, discard);
}

function wireChangesHotkeys(
  vscodeApi: NonNullable<ReturnType<NonNullable<Window['acquireVsCodeApi']>>>,
  changes: HTMLElement,
): void {
  changes.addEventListener('keydown', (e: KeyboardEvent) => {
    const isMetaA = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a';
    if (!isMetaA) {
      return;
    }
    e.preventDefault();
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'selectAll' });
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

  if (!changes.dataset.commitDockHotkeys) {
    changes.dataset.commitDockHotkeys = '1';
    wireChangesHotkeys(vscodeApi, changes);
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'selection-toolbar';
  wireSelectionToolbar(vscodeApi, toolbar);
  changes.appendChild(toolbar);

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

    const count = group.files.length;

    if (group.id === 'conflicted') {
      summary.textContent = `${group.title} (${count})`;
    } else {
      const row = document.createElement('span');
      row.className = 'changes__summary-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'group-checkbox';
      cb.dataset.group = group.id;
      const selectedCount = group.files.filter((f) => f.selected).length;
      cb.checked = count > 0 && selectedCount === count;
      cb.indeterminate = selectedCount > 0 && selectedCount < count;
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => {
        vscodeApi.postMessage({
          protocolVersion: PROTOCOL_VERSION,
          type: 'setGroupSelection',
          payload: { group: group.id, checked: cb.checked },
        });
      });

      const label = document.createElement('span');
      label.className = 'changes__summary-label';
      label.textContent = `${group.title} (${count})`;

      row.append(cb, label);
      summary.appendChild(row);
    }

    details.appendChild(summary);

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

        if (group.id !== 'conflicted') {
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'row-checkbox';
          cb.checked = file.selected;
          cb.dataset.path = file.path;
          cb.addEventListener('change', () => {
            vscodeApi.postMessage({
              protocolVersion: PROTOCOL_VERSION,
              type: 'setPathSelected',
              payload: { path: file.path, selected: cb.checked },
            });
          });
          li.appendChild(cb);
        }

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
