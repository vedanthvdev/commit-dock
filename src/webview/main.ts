import { PROTOCOL_VERSION, type HostToWebviewMessage, type RepoSnapshot, type StashSnapshotEntry } from '../protocol';
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
  commitAmend?: boolean;
  commitDockTab?: 'commit' | 'stash';
};

function main(): void {
  const vscodeApiRaw = window.acquireVsCodeApi?.();
  if (!vscodeApiRaw) {
    return;
  }
  const vscodeApi = vscodeApiRaw;

  vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'ready' });

  const initialPersisted = vscodeApi.getState() as PersistedUiState | undefined;
  let activeTab: 'commit' | 'stash' = initialPersisted?.commitDockTab === 'stash' ? 'stash' : 'commit';

  let lastGitOk = false;
  let lastSnapshot: RepoSnapshot | undefined;
  let committing = false;
  let pushing = false;
  let stashBusy = false;
  let pendingCommitThenPush = false;
  let uiMutationPending = false;

  const textarea = document.getElementById('commit-message') as HTMLTextAreaElement | null;
  const commitBtn = document.getElementById('commit-submit') as HTMLButtonElement | null;
  const commitAndPushBtn = document.getElementById('commit-and-push') as HTMLButtonElement | null;
  const commitHint = document.getElementById('commit-hint') as HTMLParagraphElement | null;
  const amendCb = document.getElementById('commit-amend') as HTMLInputElement | null;
  const pushFwlBtn = document.getElementById('commit-push-fwl') as HTMLButtonElement | null;

  function applyCommitButtonLabels(): void {
    const amend = amendCb?.checked ?? false;
    if (commitBtn) {
      commitBtn.textContent = amend ? 'Amend Commit' : 'Commit';
    }
    if (commitAndPushBtn) {
      commitAndPushBtn.textContent = amend ? 'Amend Commit and Push…' : 'Commit and Push…';
    }
  }

  let actionStatusTimer: number | undefined;

  function setActionStatus(text: string, kind: 'info' | 'error' | 'success'): void {
    const el = document.getElementById('action-status');
    if (!el) {
      return;
    }
    if (actionStatusTimer !== undefined) {
      window.clearTimeout(actionStatusTimer);
      actionStatusTimer = undefined;
    }
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'action-status';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = `action-status action-status--${kind}`;
    actionStatusTimer = window.setTimeout(() => {
      el.hidden = true;
      el.textContent = '';
      el.className = 'action-status';
      actionStatusTimer = undefined;
    }, 7000);
  }

  function beginRepoMutation(): void {
    uiMutationPending = true;
    updateCommitPanelState();
  }

  function applyTabUI(): void {
    const tabCommitBtn = document.getElementById('tab-commit');
    const tabStashBtn = document.getElementById('tab-stash');
    const panelCommit = document.getElementById('tab-panel-commit');
    const panelStash = document.getElementById('tab-panel-stash');
    const isCommit = activeTab === 'commit';

    tabCommitBtn?.classList.toggle('tab-strip__tab--active', isCommit);
    tabStashBtn?.classList.toggle('tab-strip__tab--active', !isCommit);
    tabCommitBtn?.setAttribute('aria-selected', String(isCommit));
    tabStashBtn?.setAttribute('aria-selected', String(!isCommit));

    if (panelCommit) {
      panelCommit.hidden = !isCommit;
      panelCommit.classList.toggle('tab-panel--active', isCommit);
    }
    if (panelStash) {
      panelStash.hidden = isCommit;
      panelStash.classList.toggle('tab-panel--active', !isCommit);
    }
  }

  function updateStashPanelState(): void {
    const refresh = document.getElementById('stash-refresh') as HTMLButtonElement | null;
    const root = lastSnapshot?.rootPath?.length ? lastSnapshot.rootPath : '';
    const hasRepo = !!root;
    const busy = stashBusy || committing || pushing || uiMutationPending;
    if (refresh) {
      refresh.disabled = busy || !hasRepo || !lastGitOk;
    }
    for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('.stash-list__action'))) {
      btn.disabled = busy;
    }
  }

  function updateCommitPanelState(): void {
    const workspace = document.getElementById('workspace');
    if (workspace) {
      workspace.hidden = !lastGitOk;
    }
    if (textarea && commitBtn) {
      const root = lastSnapshot?.rootPath?.length ? lastSnapshot.rootPath : '';
      const conflictCount = lastSnapshot?.groups.find((g) => g.id === 'conflicted')?.files.length ?? 0;
      const hasRepo = !!root;
      const blocked = conflictCount > 0;
      const busy = committing || pushing || stashBusy || uiMutationPending;
      commitBtn.disabled = busy || !hasRepo || blocked;
      textarea.disabled = !lastGitOk || !hasRepo;
      if (amendCb) {
        amendCb.disabled = !lastGitOk || !hasRepo;
      }
      if (commitAndPushBtn) {
        commitAndPushBtn.disabled = busy || !hasRepo || blocked;
      }
      if (pushFwlBtn) {
        pushFwlBtn.disabled = busy || !hasRepo || blocked;
      }
    }
    applyCommitButtonLabels();
    updateStashPanelState();
  }

  function setTab(tab: 'commit' | 'stash', persist: boolean): void {
    if (tab !== 'commit' && tab !== 'stash') {
      return;
    }
    const prevTab = activeTab;
    activeTab = tab;
    applyTabUI();
    if (persist && prevTab !== tab) {
      const prevState = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
      vscodeApi.setState({ ...prevState, commitDockTab: tab });
    }
    if (tab === 'stash' && prevTab !== tab) {
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'requestStashList' });
    }
    updateCommitPanelState();
  }

  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-strip__tab[data-tab]'))) {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      if (t === 'commit' || t === 'stash') {
        setTab(t, true);
      }
    });
  }

  applyTabUI();
  if (activeTab === 'stash') {
    vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'requestStashList' });
  }

  const persistCommitUi = (): void => {
    if (!textarea) {
      return;
    }
    const prev = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
    vscodeApi.setState({
      ...prev,
      commitDraft: textarea.value,
      commitAmend: amendCb?.checked ?? false,
    });
  };

  let draftTimer: number | undefined;
  function onCommitInput(): void {
    if (draftTimer !== undefined) {
      window.clearTimeout(draftTimer);
    }
    draftTimer = window.setTimeout(() => {
      persistCommitUi();
    }, 250);
  }

  const submitCommit = (): void => {
    if (!textarea || !commitBtn || commitBtn.disabled || committing || pushing || stashBusy) {
      return;
    }
    const amend = amendCb?.checked ?? false;
    const trimmed = textarea.value.trim();
    if (!amend && !trimmed.length) {
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
    setActionStatus('Committing…', 'info');
    updateCommitPanelState();
    vscodeApi.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: 'commit',
      payload: { message: textarea.value, amend },
    });
  };

  const submitCommitAndPush = (): void => {
    if (!textarea || !commitAndPushBtn || commitAndPushBtn.disabled || committing || pushing || stashBusy) {
      return;
    }
    const amend = amendCb?.checked ?? false;
    const trimmed = textarea.value.trim();
    if (!amend && !trimmed.length) {
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
    pendingCommitThenPush = true;
    setActionStatus('Committing and pushing…', 'info');
    updateCommitPanelState();
    vscodeApi.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: 'commitAndPush',
      payload: { message: textarea.value, amend },
    });
  };

  if (textarea && commitBtn) {
    const persisted = vscodeApi.getState() as PersistedUiState | undefined;
    if (typeof persisted?.commitDraft === 'string') {
      textarea.value = persisted.commitDraft;
    }
    if (amendCb && persisted?.commitAmend) {
      amendCb.checked = true;
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
    if (amendCb) {
      amendCb.addEventListener('change', () => {
        persistCommitUi();
        applyCommitButtonLabels();
        const amendHead = document.querySelector('[data-commit-dock-group="amend-head"]');
        if (amendHead instanceof HTMLDetailsElement) {
          amendHead.open = amendCb.checked;
        }
        if (amendCb.checked) {
          vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'requestHeadCommitMessage' });
        }
        if (lastSnapshot) {
          renderRepoSnapshot(vscodeApi, lastSnapshot, { beginRepoMutation, setActionStatus });
        }
      });
      if (amendCb.checked) {
        vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'requestHeadCommitMessage' });
      }
    }
    if (commitAndPushBtn) {
      commitAndPushBtn.addEventListener('click', () => {
        submitCommitAndPush();
      });
    }
    if (pushFwlBtn) {
      pushFwlBtn.addEventListener('click', () => {
        if (pushing || committing || stashBusy) {
          return;
        }
        pushing = true;
        setActionStatus('Pushing…', 'info');
        updateCommitPanelState();
        vscodeApi.postMessage({
          protocolVersion: PROTOCOL_VERSION,
          type: 'push',
          payload: { forceWithLease: true },
        });
      });
    }
    applyCommitButtonLabels();
  }

  function renderStashRows(entries: readonly StashSnapshotEntry[]): void {
    const ul = document.getElementById('stash-list');
    if (!ul) {
      return;
    }
    ul.replaceChildren();
    if (entries.length === 0) {
      const li = document.createElement('li');
      li.className = 'stash-list__empty';
      li.textContent = 'No stashes';
      ul.appendChild(li);
      return;
    }
    for (const e of entries) {
      const li = document.createElement('li');
      li.className = 'stash-list__row';

      const desc = document.createElement('span');
      desc.className = 'stash-list__desc';
      desc.textContent = `stash@{${e.index}}: ${e.description}`;

      const actions = document.createElement('span');
      actions.className = 'stash-list__actions';

      const mk = (label: string, action: string): HTMLButtonElement => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stash-list__btn stash-list__action';
        b.textContent = label;
        b.dataset.stashAction = action;
        b.dataset.stashIndex = String(e.index);
        return b;
      };

      actions.append(mk('Apply', 'apply'), mk('Pop', 'pop'), mk('Drop', 'drop'));
      li.append(desc, actions);
      ul.appendChild(li);
    }
  }

  function wireStashListClicks(
    vscodeApi: NonNullable<ReturnType<NonNullable<Window['acquireVsCodeApi']>>>,
  ): void {
    const ul = document.getElementById('stash-list');
    if (!ul) {
      return;
    }
    ul.addEventListener('click', (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      const btn = target?.closest?.('button[data-stash-action]') as HTMLButtonElement | null;
      if (!btn || stashBusy || committing || pushing) {
        return;
      }
      const action = btn.dataset.stashAction;
      const indexStr = btn.dataset.stashIndex;
      if (!action || indexStr === undefined) {
        return;
      }
      const index = Number(indexStr);
      if (!Number.isInteger(index) || index < 0) {
        return;
      }
      stashBusy = true;
      updateCommitPanelState();
      if (action === 'apply') {
        vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'stashApply', payload: { index } });
      } else if (action === 'pop') {
        vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'stashPop', payload: { index } });
      } else if (action === 'drop') {
        vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'stashDrop', payload: { index } });
      } else {
        stashBusy = false;
        updateCommitPanelState();
      }
    });
  }

  wireStashListClicks(vscodeApi);

  const stashRefresh = document.getElementById('stash-refresh') as HTMLButtonElement | null;
  if (stashRefresh) {
    stashRefresh.addEventListener('click', () => {
      if (stashBusy || committing || pushing) {
        return;
      }
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'requestStashList' });
    });
  }

  const stashHint = document.getElementById('stash-hint') as HTMLParagraphElement | null;

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
      uiMutationPending = false;
      renderRepoSnapshot(vscodeApi, msg.payload, { beginRepoMutation, setActionStatus });
      updateCommitPanelState();
    }
    if (msg.type === 'headCommitMessage') {
      if (msg.payload.ok) {
        if (commitHint) {
          commitHint.hidden = true;
        }
        if (msg.payload.message && textarea && amendCb?.checked && !textarea.value.trim()) {
          textarea.value = msg.payload.message;
          persistCommitUi();
        }
      } else if (commitHint) {
        commitHint.hidden = false;
        commitHint.textContent = msg.payload.detail ?? 'Could not load the previous commit message.';
      }
    }
    if (msg.type === 'commitResult') {
      committing = false;
      let enteringPushPhase = false;
      if (pendingCommitThenPush) {
        if (msg.payload.ok) {
          pushing = true;
          enteringPushPhase = true;
          setActionStatus('Pushing…', 'info');
        } else {
          pendingCommitThenPush = false;
        }
      }

      if (msg.payload.ok) {
        if (textarea) {
          textarea.value = '';
        }
        const prev = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
        vscodeApi.setState({ ...prev, commitDraft: '', commitAmend: amendCb?.checked ?? false });
        if (commitHint) {
          commitHint.hidden = true;
          commitHint.textContent = '';
        }
        if (!enteringPushPhase) {
          setActionStatus(amendCb?.checked ? 'Amend completed.' : 'Committed.', 'success');
        }
      } else {
        if (commitHint) {
          commitHint.hidden = false;
          commitHint.textContent = msg.payload.detail ?? 'Commit failed.';
        }
        setActionStatus(msg.payload.detail ?? 'Commit failed.', 'error');
      }
      updateCommitPanelState();
    }
    if (msg.type === 'pushResult') {
      pushing = false;
      pendingCommitThenPush = false;
      if (!msg.payload.ok) {
        if (commitHint) {
          commitHint.hidden = false;
          commitHint.textContent = msg.payload.detail ?? 'Push failed.';
        }
        setActionStatus(msg.payload.detail ?? 'Push failed.', 'error');
      } else {
        if (commitHint) {
          commitHint.hidden = true;
          commitHint.textContent = '';
        }
        setActionStatus('Push completed.', 'success');
      }
      updateCommitPanelState();
    }
    if (msg.type === 'stashList') {
      renderStashRows(msg.payload.entries);
      if (stashHint) {
        if (!msg.payload.ok) {
          stashHint.hidden = false;
          stashHint.textContent = msg.payload.detail ?? 'Could not list stashes.';
        } else {
          stashHint.hidden = true;
          stashHint.textContent = '';
        }
      }
      updateCommitPanelState();
    }
    if (msg.type === 'stashResult') {
      stashBusy = false;
      if (stashHint) {
        if (!msg.payload.ok && msg.payload.detail) {
          stashHint.hidden = false;
          stashHint.textContent = msg.payload.detail;
          setActionStatus(msg.payload.detail, 'error');
        } else if (msg.payload.ok) {
          stashHint.hidden = true;
          stashHint.textContent = '';
          setActionStatus('Stash operation completed.', 'success');
        }
      }
      updateCommitPanelState();
    }
  });
}

function firstSelectedPath(snapshot: RepoSnapshot): string | undefined {
  for (const g of snapshot.groups) {
    if (g.id === 'conflicted') {
      continue;
    }
    for (const f of g.files) {
      if (f.selected) {
        return f.path;
      }
    }
  }
  return undefined;
}

function attachOpenDiffOnRowClick(
  li: HTMLLIElement,
  fsPath: string,
  vscodeApi: NonNullable<ReturnType<NonNullable<Window['acquireVsCodeApi']>>>,
): void {
  li.classList.add('file-list__row--clickable');
  if (!li.title) {
    li.title = 'Open diff for this file';
  }
  li.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || target.closest('input.row-checkbox')) {
      return;
    }
    vscodeApi.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: 'openDiff',
      payload: { path: fsPath },
    });
  });
}

function createToolbarIconButton(title: string, codicon: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'changes-toolbar__iconbtn';
  b.title = title;
  b.setAttribute('aria-label', title);
  const icon = document.createElement('span');
  icon.className = `codicon ${codicon}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.title = title;
  b.appendChild(icon);
  b.addEventListener('click', onClick);
  return b;
}

function appendToolbarSeparator(toolbar: HTMLElement): void {
  const sep = document.createElement('span');
  sep.className = 'changes-toolbar__sep';
  sep.setAttribute('aria-hidden', 'true');
  toolbar.appendChild(sep);
}

function wireChangesToolbar(
  vscodeApi: NonNullable<ReturnType<NonNullable<Window['acquireVsCodeApi']>>>,
  toolbar: HTMLElement,
  snapshot: RepoSnapshot,
  beginRepoMutation: () => void,
  setStatus: (text: string, kind: 'info' | 'error' | 'success') => void,
): void {
  toolbar.replaceChildren();

  toolbar.appendChild(
    createToolbarIconButton('Refresh git status', 'codicon-sync', () => {
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'refreshView' });
    }),
  );

  toolbar.appendChild(
    createToolbarIconButton('Open diff for selected file', 'codicon-git-compare', () => {
      const p = firstSelectedPath(snapshot);
      if (!p) {
        setStatus('Check a file or click its row to open a diff.', 'error');
        return;
      }
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'openDiff', payload: { path: p } });
    }),
  );

  toolbar.appendChild(
    createToolbarIconButton('Stash all changes (including untracked)', 'codicon-git-stash', () => {
      beginRepoMutation();
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'quickStash' });
    }),
  );

  appendToolbarSeparator(toolbar);

  toolbar.appendChild(
    createToolbarIconButton('Select all files', 'codicon-list-selection', () => {
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'selectAll' });
    }),
  );

  toolbar.appendChild(
    createToolbarIconButton('Deselect all files', 'codicon-clear-all', () => {
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'deselectAll' });
    }),
  );

  toolbar.appendChild(
    createToolbarIconButton('Stage selected files', 'codicon-cloud-upload', () => {
      beginRepoMutation();
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'stageSelected' });
    }),
  );

  toolbar.appendChild(
    createToolbarIconButton('Unstage selected files', 'codicon-cloud-download', () => {
      beginRepoMutation();
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'unstageSelected' });
    }),
  );

  toolbar.appendChild(
    createToolbarIconButton('Discard selected changes', 'codicon-discard', () => {
      beginRepoMutation();
      vscodeApi.postMessage({ protocolVersion: PROTOCOL_VERSION, type: 'discardSelected' });
    }),
  );
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
  toolbarDeps: {
    beginRepoMutation: () => void;
    setActionStatus: (text: string, kind: 'info' | 'error' | 'success') => void;
  },
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
  toolbar.className = 'selection-toolbar changes-toolbar';
  wireChangesToolbar(vscodeApi, toolbar, snapshot, toolbarDeps.beginRepoMutation, toolbarDeps.setActionStatus);
  changes.appendChild(toolbar);

  const persisted = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};

  if (repoLine) {
    if (snapshot.rootName) {
      repoLine.hidden = false;
      repoLine.textContent = snapshot.rootName;
      if (snapshot.rootPath) {
        repoLine.title = snapshot.rootPath;
      } else {
        repoLine.removeAttribute('title');
      }
    } else {
      repoLine.hidden = true;
      repoLine.textContent = '';
      repoLine.removeAttribute('title');
    }
  }

  for (const group of snapshot.groups) {
    const count = group.files.length;
    if (group.id === 'conflicted' && count === 0) {
      continue;
    }

    const details = document.createElement('details');
    details.className = `changes__group changes__group--${group.id}`;

    const summary = document.createElement('summary');
    summary.className = 'changes__summary';

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
      cb.addEventListener('click', (e: MouseEvent) => e.stopPropagation());
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
        attachOpenDiffOnRowClick(li, file.path, vscodeApi);
        list.appendChild(li);
      }
    }

    details.appendChild(list);
    changes.appendChild(details);
  }

  const amendCbEl = document.getElementById('commit-amend') as HTMLInputElement | null;
  const amendChecked = amendCbEl?.checked ?? false;
  if (amendChecked && snapshot.amendHeadFiles?.length) {
    const details = document.createElement('details');
    details.dataset.commitDockGroup = 'amend-head';
    details.className = 'changes__group changes__group--amend-head';
    const summary = document.createElement('summary');
    summary.className = 'changes__summary';
    const row = document.createElement('span');
    row.className = 'changes__summary-row changes__summary-row--text-only';
    const label = document.createElement('span');
    label.className = 'changes__summary-label';
    label.textContent = `Included in last commit (${snapshot.amendHeadFiles.length})`;
    row.appendChild(label);
    summary.appendChild(row);
    details.appendChild(summary);

    const list = document.createElement('ul');
    list.className = 'file-list file-list--readonly';
    for (const f of snapshot.amendHeadFiles) {
      const li = document.createElement('li');
      li.className = 'file-list__row file-list__row--amend-head';
      const name = document.createElement('span');
      name.className = 'file-list__name';
      name.textContent = f.relPath;
      li.appendChild(name);
      attachOpenDiffOnRowClick(li, f.path, vscodeApi);
      list.appendChild(li);
    }
    details.appendChild(list);

    const persistedOpen = persisted.detailsOpen?.['amendHead'];
    details.open = persistedOpen !== undefined ? persistedOpen : true;

    details.addEventListener('toggle', () => {
      const prev = (vscodeApi.getState() as PersistedUiState | undefined) ?? {};
      vscodeApi.setState({
        ...prev,
        detailsOpen: {
          ...(prev.detailsOpen ?? {}),
          amendHead: details.open,
        },
      });
    });

    changes.appendChild(details);
  }
}

main();
