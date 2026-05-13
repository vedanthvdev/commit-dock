import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Avoid pathological `stash list` output tying up memory or UI. */
const MAX_STASH_LINES = 500;
const MAX_REPO_ROOT_LEN = 4096;

export interface StashListEntry {
  index: number;
  /** One-line description (same as `git stash list`). */
  description: string;
}

const STASH_LINE = /^stash@\{(\d+)\}:\s*(.*)$/;

function assertSafeRepoRoot(repoRoot: string): void {
  const trimmed = repoRoot.trim();
  if (!trimmed || trimmed.length > MAX_REPO_ROOT_LEN || trimmed.includes('\0')) {
    throw new Error('Invalid repository path for stash list.');
  }
  const normalized = path.normalize(trimmed);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(normalized);
  } catch {
    throw new Error('Repository path is not accessible for stash list.');
  }
  if (!stat.isDirectory()) {
    throw new Error('Repository path is not a directory.');
  }
}

/**
 * Reads `git stash list` from the repository root. Uses the `git` on `PATH`
 * for that folder (not VS Code’s bundled Git). Arguments are fixed (no shell);
 * `cwd` is validated as a normal directory before execution.
 */
export async function listGitStashes(repoRoot: string): Promise<StashListEntry[]> {
  assertSafeRepoRoot(repoRoot);
  const cwd = path.normalize(repoRoot.trim());
  const { stdout } = await execFileAsync('git', ['stash', 'list'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  const lines = stdout
    .split('\n')
    .filter((l) => l.length > 0)
    .slice(0, MAX_STASH_LINES);
  const out: StashListEntry[] = [];
  for (const line of lines) {
    const m = STASH_LINE.exec(line);
    if (!m) {
      continue;
    }
    out.push({ index: Number(m[1]), description: m[2] ?? '' });
  }
  return out;
}
