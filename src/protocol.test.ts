import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, parseWebviewMessage } from './protocol';

const pv = PROTOCOL_VERSION;

describe('parseWebviewMessage', () => {
  it('accepts toolbar / selection actions', () => {
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'quickStash' })).toEqual({
      protocolVersion: pv,
      type: 'quickStash',
    });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'refreshView' })).toEqual({
      protocolVersion: pv,
      type: 'refreshView',
    });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'stageSelected' })).toEqual({
      protocolVersion: pv,
      type: 'stageSelected',
    });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'unstageSelected' })).toEqual({
      protocolVersion: pv,
      type: 'unstageSelected',
    });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'discardSelected' })).toEqual({
      protocolVersion: pv,
      type: 'discardSelected',
    });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'selectAll' })).toEqual({
      protocolVersion: pv,
      type: 'selectAll',
    });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'deselectAll' })).toEqual({
      protocolVersion: pv,
      type: 'deselectAll',
    });
  });

  it('parses openDiff with a valid path', () => {
    expect(
      parseWebviewMessage({
        protocolVersion: pv,
        type: 'openDiff',
        payload: { path: '/repo/src/a.ts' },
      }),
    ).toEqual({
      protocolVersion: pv,
      type: 'openDiff',
      payload: { path: '/repo/src/a.ts' },
    });
  });

  it('rejects openDiff with invalid payload', () => {
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'openDiff', payload: {} })).toBeUndefined();
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'openDiff', payload: { path: '' } })).toBeUndefined();
  });

  it('parses openFirstMergeConflictDiffFromWebview', () => {
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'openFirstMergeConflictDiffFromWebview' })).toEqual({
      protocolVersion: pv,
      type: 'openFirstMergeConflictDiffFromWebview',
    });
  });

  it('parses commit and commitAndPush with amend', () => {
    expect(
      parseWebviewMessage({
        protocolVersion: pv,
        type: 'commit',
        payload: { message: ' ', amend: true },
      }),
    ).toEqual({
      protocolVersion: pv,
      type: 'commit',
      payload: { message: ' ', amend: true },
    });
    expect(
      parseWebviewMessage({
        protocolVersion: pv,
        type: 'commitAndPush',
        payload: { message: 'hello', amend: false },
      }),
    ).toEqual({
      protocolVersion: pv,
      type: 'commitAndPush',
      payload: { message: 'hello', amend: false },
    });
  });

  it('parses push with optional forceWithLease', () => {
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'push', payload: {} })).toEqual({
      protocolVersion: pv,
      type: 'push',
      payload: { forceWithLease: false },
    });
    expect(
      parseWebviewMessage({ protocolVersion: pv, type: 'push', payload: { forceWithLease: true } }),
    ).toEqual({
      protocolVersion: pv,
      type: 'push',
      payload: { forceWithLease: true },
    });
  });

  it('parses stash list mutations', () => {
    expect(
      parseWebviewMessage({ protocolVersion: pv, type: 'stashApply', payload: { index: 0 } }),
    ).toEqual({ protocolVersion: pv, type: 'stashApply', payload: { index: 0 } });
    expect(parseWebviewMessage({ protocolVersion: pv, type: 'stashPop', payload: { index: 2 } })).toEqual({
      protocolVersion: pv,
      type: 'stashPop',
      payload: { index: 2 },
    });
  });
});
