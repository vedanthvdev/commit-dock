/**
 * Shared `execFile` options for non-interactive `git` subprocess calls from the extension host.
 * Avoids implicit shells and prevents transient console flashes on Windows.
 */
export const gitExecFileBase = {
  windowsHide: true,
  shell: false,
} as const;
