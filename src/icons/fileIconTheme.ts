import * as path from 'path';

export type ResolvedFileIcon =
  | { kind: 'font'; fontId?: string; codePoint: number; color: string; fontSize?: string }
  | { kind: 'image'; relativePath: string };

type IconDef = {
  iconPath?: string;
  fontCharacter?: string;
  fontColor?: string;
  fontId?: string;
  fontSize?: string;
};

export type FileIconThemeFont = {
  id: string;
  src: Array<{ path: string; format?: string }>;
  weight?: string;
  style?: string;
  size?: string;
};

export type FileIconThemeDocument = {
  fonts?: FileIconThemeFont[];
  iconDefinitions: Record<string, IconDef>;
  file: string;
  fileNames?: Record<string, string>;
  fileExtensions?: Record<string, string>;
  languageIds?: Record<string, string>;
  light?: {
    file?: string;
    fileNames?: Record<string, string>;
    fileExtensions?: Record<string, string>;
    languageIds?: Record<string, string>;
  };
};

function mergeRecords<T extends Record<string, string>>(
  base: T | undefined,
  override: T | undefined,
): Record<string, string> {
  return { ...(base ?? {}), ...(override ?? {}) };
}

export function parseFontCharacter(raw: string): number | undefined {
  let hex = raw.trim();
  // Themes store values like "\\E099" which JSON-parses to a leading backslash marker + hex digits.
  if (hex.startsWith('\\')) {
    hex = hex.slice(1);
  }
  if (!/^[0-9A-Fa-f]+$/i.test(hex)) {
    return undefined;
  }
  return parseInt(hex, 16);
}

function resolveDefinition(defId: string, defs: Record<string, IconDef>, fallbackId: string): ResolvedFileIcon | undefined {
  for (const id of [defId, fallbackId]) {
    const def = defs[id];
    if (!def) {
      continue;
    }
    if (typeof def.iconPath === 'string' && def.iconPath.length > 0) {
      return { kind: 'image', relativePath: def.iconPath };
    }
    if (typeof def.fontCharacter === 'string') {
      const cp = parseFontCharacter(def.fontCharacter);
      if (cp === undefined) {
        continue;
      }
      const color = typeof def.fontColor === 'string' && def.fontColor.length > 0 ? def.fontColor : 'currentColor';
      return {
        kind: 'font',
        fontId: def.fontId,
        codePoint: cp,
        color,
        fontSize: typeof def.fontSize === 'string' ? def.fontSize : undefined,
      };
    }
  }
  return undefined;
}

export class FileIconThemeResolver {
  private readonly defs: Record<string, IconDef>;
  private readonly defaultFileKey: string;
  private readonly defaultFileKeyLight: string;
  private readonly fileNamesDark: Record<string, string>;
  private readonly fileNamesLight: Record<string, string>;
  private readonly fileExtensionsDark: Record<string, string>;
  private readonly fileExtensionsLight: Record<string, string>;
  private readonly languageIdsDark: Record<string, string>;
  private readonly languageIdsLight: Record<string, string>;
  private readonly extKeysDark: readonly string[];
  private readonly extKeysLight: readonly string[];

  constructor(theme: FileIconThemeDocument) {
    this.defs = theme.iconDefinitions;
    this.defaultFileKey = theme.file;
    this.defaultFileKeyLight = theme.light?.file ?? theme.file;

    this.fileNamesDark = mergeRecords(theme.fileNames, undefined);
    this.fileNamesLight = mergeRecords(theme.fileNames, theme.light?.fileNames);

    this.fileExtensionsDark = mergeRecords(theme.fileExtensions, undefined);
    this.fileExtensionsLight = mergeRecords(theme.fileExtensions, theme.light?.fileExtensions);

    this.languageIdsDark = mergeRecords(theme.languageIds, undefined);
    this.languageIdsLight = mergeRecords(theme.languageIds, theme.light?.languageIds);

    this.extKeysDark = sortExtensionKeys(this.fileExtensionsDark);
    this.extKeysLight = sortExtensionKeys(this.fileExtensionsLight);
  }

  resolve(fsPath: string, languageId: string, isLight: boolean): ResolvedFileIcon | undefined {
    const fileNames = isLight ? this.fileNamesLight : this.fileNamesDark;
    const fileExtensions = isLight ? this.fileExtensionsLight : this.fileExtensionsDark;
    const languageIds = isLight ? this.languageIdsLight : this.languageIdsDark;
    const extKeys = isLight ? this.extKeysLight : this.extKeysDark;
    const defaultKey = isLight ? this.defaultFileKeyLight : this.defaultFileKey;

    const lowerPath = fsPath.toLowerCase();
    const base = path.basename(lowerPath);

    const byName = fileNames[base];
    if (byName) {
      return resolveDefinition(byName, this.defs, defaultKey);
    }

    for (const key of extKeys) {
      if (!extKeyMatches(lowerPath, key)) {
        continue;
      }
      const defId = fileExtensions[key];
      if (defId) {
        const g = resolveDefinition(defId, this.defs, defaultKey);
        if (g) {
          return g;
        }
      }
    }

    const lang = languageId.trim();
    if (lang) {
      const defId = languageIds[lang];
      if (defId) {
        const g = resolveDefinition(defId, this.defs, defaultKey);
        if (g) {
          return g;
        }
      }
    }

    return resolveDefinition(defaultKey, this.defs, defaultKey);
  }
}

export function parseFileIconThemeDocument(raw: unknown): FileIconThemeResolver | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const theme = raw as FileIconThemeDocument;
  if (!theme.iconDefinitions || typeof theme.file !== 'string') {
    return undefined;
  }
  return new FileIconThemeResolver(theme);
}

function sortExtensionKeys(map: Record<string, string>): string[] {
  return Object.keys(map).sort((a, b) => b.length - a.length);
}

function extKeyMatches(filePathLower: string, key: string): boolean {
  if (key.includes('.')) {
    return filePathLower.endsWith(`.${key}`);
  }
  const ext = path.extname(filePathLower).slice(1);
  return ext === key;
}
