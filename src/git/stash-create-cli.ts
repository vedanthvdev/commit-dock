import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MAX_MESSAGE_LEN = 1024;

export type CreateStashCliOptions = {
  message: string;
  includeUntracked?: boolean;
  staged?: boolean;
};

function assertSafeRepoRoot(repoRoot: string): string {
  const trimmed = repoRoot.trim();
  if (!trimmed || trimmed.includes('\0')) {
    throw new Error('Invalid repository root for stash.');
  }
  return path.resolve(trimmed);
}

/**
 * Create a stash using the Git CLI (`git stash push`).
 * Used when the built-in Git extension `Repository.createStash` is missing or fails.
 */
export async function createStashViaCli(repoRoot: string, options: CreateStashCliOptions): Promise<void> {
  const root = assertSafeRepoRoot(repoRoot);
  const msg = options.message.trim().slice(0, MAX_MESSAGE_LEN);
  if (!msg) {
    throw new Error('Stash message is required.');
  }
  const args: string[] = ['-C', root, 'stash', 'push'];
  if (options.includeUntracked === true) {
    args.push('-u');
  }
  if (options.staged === true) {
    args.push('--staged');
  }
  args.push('-m', msg);
  await execFileAsync('git', args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
}

export type RepoWithOptionalCreateStash = {
  createStash?: (options?: { message?: string; includeUntracked?: boolean; staged?: boolean }) => Promise<void>;
};

/**
 * Prefer the Git extension API when available; otherwise use `git stash push`.
 * If the API exists but rejects (e.g. nothing to stash), that error is propagated.
 */
export async function createStashWithRepoApiFallback(
  repoRoot: string,
  repo: RepoWithOptionalCreateStash,
  options: CreateStashCliOptions,
): Promise<void> {
  if (typeof repo.createStash === 'function') {
    await repo.createStash(options);
    return;
  }
  await createStashViaCli(repoRoot, options);
}
