import { describe, expect, it } from 'vitest';
import { FileIconThemeResolver } from './fileIconTheme';

describe('FileIconThemeResolver', () => {
  const theme = {
    fonts: [{ id: 'f1', src: [{ path: './x.woff', format: 'woff' }] }],
    iconDefinitions: {
      _default: { fontCharacter: '\\E023', fontColor: '#111111' },
      _json: { fontCharacter: '\\E055', fontColor: '#222222' },
      _typescript: { fontCharacter: '\\E099', fontColor: '#333333', fontId: 'f1' },
      _spec_ts: { fontCharacter: '\\E099', fontColor: '#444444' },
    },
    file: '_default',
    fileExtensions: {
      json: '_json',
      'spec.ts': '_spec_ts',
    },
    languageIds: {
      typescript: '_typescript',
    },
    light: {
      file: '_default',
      fileExtensions: {
        json: '_json',
      },
    },
  };

  it('matches fileNames', () => {
    const withNames = {
      ...theme,
      fileNames: { dockerfile: '_json' },
    };
    const r = new FileIconThemeResolver(withNames as never);
    const g = r.resolve('/repo/Dockerfile', 'dockerfile', false);
    expect(g?.kind).toBe('font');
    if (g?.kind === 'font') {
      expect(g.color).toBe('#222222');
    }
  });

  it('matches compound extension keys with higher priority than languageIds', () => {
    const r = new FileIconThemeResolver(theme as never);
    const spec = r.resolve('/repo/foo.spec.ts', 'typescript', false);
    expect(spec?.kind).toBe('font');
    if (spec?.kind === 'font') {
      expect(spec.color).toBe('#444444');
    }
    const normal = r.resolve('/repo/foo.ts', 'typescript', false);
    expect(normal?.kind).toBe('font');
    if (normal?.kind === 'font') {
      expect(normal.fontId).toBe('f1');
    }
  });

  it('falls back to languageIds for plain .ts files', () => {
    const r = new FileIconThemeResolver(theme as never);
    const g = r.resolve('/repo/foo.ts', 'typescript', false);
    expect(g?.kind).toBe('font');
    if (g?.kind === 'font') {
      expect(g.codePoint).toBe(0xe099);
    }
  });

  it('matches json by extension', () => {
    const r = new FileIconThemeResolver(theme as never);
    const g = r.resolve('/repo/tsconfig.json', 'jsonc', false);
    expect(g?.kind).toBe('font');
    if (g?.kind === 'font') {
      expect(g.color).toBe('#222222');
    }
  });

  it('supports image icon definitions', () => {
    const withImg = {
      ...theme,
      iconDefinitions: {
        ...theme.iconDefinitions,
        _img: { iconPath: './icons/x.svg' },
      },
      fileNames: { 'logo.svg': '_img' },
    };
    const r = new FileIconThemeResolver(withImg as never);
    const g = r.resolve('/repo/logo.svg', 'xml', false);
    expect(g).toEqual({ kind: 'image', relativePath: './icons/x.svg' });
  });
});
