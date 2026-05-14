import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { gitExecFileBase } from './git-exec';

const execFileAsync = promisify(execFile);

const MAX_PATHS_PER_INVOCATION = 100;

function toRepoRelativePaths(repoRoot: string, absolutePaths: readonly string[]): string[] {
  const root = path.resolve(repoRoot);
  const rels: string[] = [];
  for (const p of absolutePaths) {
    if (typeof p !== 'string' || p.includes('\0')) {
      continue;
    }
    const abs = path.resolve(p);
    const rel = path.relative(root, abs);
    if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      continue;
    }
    rels.push(rel);
  }
  return rels;
}

/**
 * Restore tracked paths in the working tree from HEAD using the Git CLI.
 * Used when the built-in Git extension `Repository.restore` is unavailable on older VS Code.
 */
export async function restoreWorkingTreePathsCli(repoRoot: string, absolutePaths: readonly string[]): Promise<void> {
  const root = path.resolve(repoRoot);
  const rels = toRepoRelativePaths(repoRoot, absolutePaths);
  if (!rels.length) {
    return;
  }

  for (let i = 0; i < rels.length; i += MAX_PATHS_PER_INVOCATION) {
    const chunk = rels.slice(i, i + MAX_PATHS_PER_INVOCATION);
    const baseOpts = {
      encoding: 'utf8' as const,
      maxBuffer: 32 * 1024 * 1024,
      ...gitExecFileBase,
    };

    try {
      await execFileAsync('git', ['-C', root, 'restore', '--worktree', '--', ...chunk], baseOpts);
    } catch {
      await execFileAsync('git', ['-C', root, 'checkout', 'HEAD', '--', ...chunk], baseOpts);
    }
  }
}
