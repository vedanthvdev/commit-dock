import { describe, expect, it } from 'vitest';
import { fileCodiconFromPath } from './file-codicons';

describe('fileCodiconFromPath', () => {
  it('maps common extensions to bundled codicons', () => {
    expect(fileCodiconFromPath('/p/a.ts')).toBe('codicon codicon-file-code');
    expect(fileCodiconFromPath('/p/x.json')).toBe('codicon codicon-json');
    expect(fileCodiconFromPath('/p/README.md')).toBe('codicon codicon-markdown');
    expect(fileCodiconFromPath('/p/README.rst')).toBe('codicon codicon-file-text');
    expect(fileCodiconFromPath('/p/app.py')).toBe('codicon codicon-python');
    expect(fileCodiconFromPath('/p/Gemfile')).toBe('codicon codicon-ruby');
    expect(fileCodiconFromPath('/p/schema.sql')).toBe('codicon codicon-database');
  });

  it('handles special filenames', () => {
    expect(fileCodiconFromPath('/repo/Dockerfile')).toBe('codicon codicon-file-code');
    expect(fileCodiconFromPath('/repo/.gitignore')).toBe('codicon codicon-diff-ignored');
    expect(fileCodiconFromPath('/repo/yarn.lock')).toBe('codicon codicon-lock');
  });

  it('falls back for unknown extensions', () => {
    expect(fileCodiconFromPath('/p/unknown.xyz')).toBe('codicon codicon-symbol-file');
  });
});
