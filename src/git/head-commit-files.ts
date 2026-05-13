import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { gitExecFileBase } from './git-exec';

const execFileAsync = promisify(execFile);

const MAX_REPO_ROOT_LEN = 4096;
const MAX_PATHS = 20_000;

function assertSafeRepoRoot(repoRoot: string): void {
  const trimmed = repoRoot.trim();
  if (!trimmed || trimmed.length > MAX_REPO_ROOT_LEN || trimmed.includes('\0')) {
    throw new Error('Invalid repository path for HEAD file list.');
  }
  const normalized = path.normalize(trimmed);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(normalized);
  } catch {
    throw new Error('Repository path is not accessible for HEAD file list.');
  }
  if (!stat.isDirectory()) {
    throw new Error('Repository path is not a directory.');
  }
}

/**
 * Paths touched by `HEAD` (same idea as IntelliJ’s “included in last commit” list when amending).
 * Uses `git show` with a fixed argument list (no shell).
 */
export async function listHeadCommitRelativePaths(repoRoot: string): Promise<string[]> {
  assertSafeRepoRoot(repoRoot);
  const cwd = path.normalize(repoRoot.trim());
  const { stdout } = await execFileAsync(
    'git',
    ['-c', 'core.pager=cat', 'show', '--pretty=format:', '--name-only', '--no-renames', 'HEAD'],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
      ...gitExecFileBase,
    },
  );
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_PATHS);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const l of lines) {
    if (seen.has(l)) {
      continue;
    }
    seen.add(l);
    deduped.push(l);
  }
  return deduped;
}
