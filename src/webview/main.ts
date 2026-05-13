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
  commitDraft?: string;
};

function main(): void {
  const vscodeApi = window.acquireVsCodeApi?.();
  if (!vscodeApi) {
    return;
  }

  vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'ready' });

  let lastGitOk = false;
  let lastSnapshot: RepoSnapshot | undefined;
  let committing = false;

  const textarea = document.getElementById('commit-message') as HTMLTextAreaElement | null;
  const commitBtn = document.getElementById('commit-submit') as HTMLButtonElement | null;
  const commitHint = document.getElementById('commit-hint') as HTMLParagraphElement | null;

  function updateCommitPanelState(): void {
    const panel = document.getElementById('commit-panel');
    if (panel) {
      panel.hidden = !lastGitOk;
    }
    if (!textarea || !commitBtn) {
      return;
    }
    const root = lastSnapshot?.rootPath?.length ? lastSnapshot.rootPath : '';
    const conflictCount = lastSnapshot?.groups.find((g) => g.id === 'conflicted')?.files.length ?? 0;
    const hasRepo = !!root;
    const blocked = conflictCount > 0;
    commitBtn.disabled = committing || !hasRepo || blocked;
    textarea.disabled = !lastGitOk || !hasRepo;
  }

  function persistCommitDraft(): void {
    if (!textarea) {
      return;
    }
    const prev = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
    vscodeApi.setState({ ...prev, commitDraft: textarea.value });
  }

  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  function onCommitInput(): void {
    if (draftTimer) {
      window.clearTimeout(draftTimer);
    }
    draftTimer = window.setTimeout(() => persistCommitDraft(), 250);
  }

  function submitCommit(): void {
    if (!textarea || !commitBtn || commitBtn.disabled || committing) {
      return;
    }
    const body = textarea.value.trim();
    if (!body.length) {
      if (commitHint) {
        commitHint.hidden = false;
        commitHint.textContent = 'Enter a commit message.';
      }
      return;
    }
    if (commitHint) {
      commitHint.hidden = true;
    }
    committing = true;
    updateCommitPanelState();
    vscodeApi.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: 'commit',
      payload: { message: textarea.value },
    });
  }

  if (textarea && commitBtn) {
    const persisted = vscodeApi.getState() as PersistedUiState | undefined;
    if (typeof persisted?.commitDraft === 'string') {
      textarea.value = persisted.commitDraft;
    }
    textarea.addEventListener('input', onCommitInput);
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submitCommit();
      }
    });
    commitBtn.addEventListener('click', () => {
      submitCommit();
    });
  }

  updateCommitPanelState();

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
      lastGitOk = msg.payload.ok;
      updateCommitPanelState();
      const status = document.getElementById('status');
      if (status) {
        status.textContent = msg.payload.detail ?? (msg.payload.ok ? 'Git ready.' : 'No Git repository.');
      }
    }
    if (msg.type === 'repoSnapshot') {
      lastSnapshot = msg.payload;
      renderRepoSnapshot(vscodeApi, msg.payload);
      updateCommitPanelState();
    }
    if (msg.type === 'commitResult') {
      committing = false;
      if (msg.payload.ok) {
        if (textarea) {
          textarea.value = '';
        }
        const prev = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
        vscodeApi.setState({ ...prev, commitDraft: '' });
        if (commitHint) {
          commitHint.hidden = true;
          commitHint.textContent = '';
        }
      } else if (commitHint) {
        commitHint.hidden = false;
        commitHint.textContent = msg.payload.detail ?? 'Commit failed.';
      }
      updateCommitPanelState();
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
