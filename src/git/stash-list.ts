import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface StashListEntry {
  index: number;
  /** One-line description (same as `git stash list`). */
  description: string;
}

const STASH_LINE = /^stash@\{(\d+)\}:\s*(.*)$/;

/**
 * Reads `git stash list` from the repository root. Uses the same Git binary
 * the user runs in the terminal for that folder (PATH), not the VS Code Git path.
 */
export async function listGitStashes(repoRoot: string): Promise<StashListEntry[]> {
  const { stdout } = await execFileAsync('git', ['stash', 'list'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  const lines = stdout.split('\n').filter((l) => l.length > 0);
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
