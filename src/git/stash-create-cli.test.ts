import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStashViaCli, createStashWithRepoApiFallback } from './stash-create-cli';

function initRepoWithCommit(dir: string): void {
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'commit-dock-test@example.com'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Commit Dock Test'], { cwd: dir, stdio: 'ignore' });
  writeFileSync(join(dir, 'tracked.txt'), 'tracked');
  execFileSync('git', ['add', 'tracked.txt'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
}

describe('createStashViaCli', () => {
  it('creates a stash including untracked files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'commit-dock-stash-cli-'));
    initRepoWithCommit(dir);
    writeFileSync(join(dir, 'untracked.txt'), 'u');

    await createStashViaCli(dir, { message: 'wip-cli-test', includeUntracked: true });

    const list = execFileSync('git', ['stash', 'list'], { cwd: dir, encoding: 'utf8' });
    expect(list).toContain('wip-cli-test');
  });
});

describe('createStashWithRepoApiFallback', () => {
  it('uses git CLI when createStash is not a function', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'commit-dock-stash-fallback-'));
    initRepoWithCommit(dir);
    writeFileSync(join(dir, 'extra.txt'), 'e');

    await createStashWithRepoApiFallback(dir, {}, { message: 'wip-fallback', includeUntracked: true });

    const list = execFileSync('git', ['stash', 'list'], { cwd: dir, encoding: 'utf8' });
    expect(list).toContain('wip-fallback');
  });

  it('calls repo.createStash when present', async () => {
    let called = false;
    const repo = {
      async createStash(_opts?: { message?: string; includeUntracked?: boolean }) {
        called = true;
      },
    };
    await createStashWithRepoApiFallback('/tmp', repo, { message: 'via-api' });
    expect(called).toBe(true);
  });
});
