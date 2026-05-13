import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AmendHeadFileEntry, FileIconFontFace, RepoSnapshot, SnapshotFile, SnapshotFileIcon } from '../protocol';
import { getActiveFileIconTheme } from './activeIconTheme';
import {
  type FileIconThemeDocument,
  type FileIconThemeFont,
  FileIconThemeResolver,
  parseFileIconThemeDocument,
} from './fileIconTheme';

type CachedTheme = { resolver: FileIconThemeResolver; doc: FileIconThemeDocument };

let cachedJsonFsPath: string | undefined;
let cachedMtimeMs = 0;
let cachedTheme: CachedTheme | undefined;

export function clearFileIconThemeCache(): void {
  cachedJsonFsPath = undefined;
  cachedMtimeMs = 0;
  cachedTheme = undefined;
}

export function fileIconThemeResourceRoots(): vscode.Uri[] {
  const active = getActiveFileIconTheme();
  return active ? [active.extensionUri] : [];
}

function pickFontSrcFile(font: FileIconThemeFont): { relPath: string; format: string } | undefined {
  const candidates = font.src ?? [];
  const prefer = ['woff', 'woff2', 'ttf', 'otf'];
  for (const fmt of prefer) {
    const hit = candidates.find((s) => s && typeof s.path === 'string' && (s.format ?? '').toLowerCase() === fmt);
    if (hit?.path) {
      return { relPath: hit.path, format: fmt };
    }
  }
  const any = candidates.find((s) => s && typeof s.path === 'string');
  if (!any?.path) {
    return undefined;
  }
  const fmt = (any.format ?? 'woff').toLowerCase();
  return { relPath: any.path, format: fmt };
}

function formatMime(fmt: string): string {
  if (fmt === 'woff2') {
    return 'woff2';
  }
  if (fmt === 'ttf' || fmt === 'otf') {
    return 'truetype';
  }
  return 'woff';
}

async function loadCachedTheme(themeJsonFsPath: string): Promise<CachedTheme | undefined> {
  const st = await fs.promises.stat(themeJsonFsPath);
  if (cachedTheme && cachedJsonFsPath === themeJsonFsPath && st.mtimeMs === cachedMtimeMs) {
    return cachedTheme;
  }
  const raw: unknown = JSON.parse(await fs.promises.readFile(themeJsonFsPath, 'utf8'));
  const resolver = parseFileIconThemeDocument(raw);
  if (!resolver) {
    return undefined;
  }
  const doc = raw as FileIconThemeDocument;
  cachedJsonFsPath = themeJsonFsPath;
  cachedMtimeMs = st.mtimeMs;
  cachedTheme = { resolver, doc };
  return cachedTheme;
}

async function languageIdsForPaths(paths: readonly string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(paths.filter((p) => p.length > 0))];
  /** Opening documents is expensive; cap work for huge snapshots (icons still resolve by extension). */
  const MAX_LANG_PATHS = 400;
  const capped = uniq.length > MAX_LANG_PATHS ? uniq.slice(0, MAX_LANG_PATHS) : uniq;
  const out = new Map<string, string>();
  const chunk = 16;
  for (let i = 0; i < capped.length; i += chunk) {
    const slice = capped.slice(i, i + chunk);
    await Promise.all(
      slice.map(async (p) => {
        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
          out.set(p, doc.languageId);
        } catch {
          out.set(p, '');
        }
      }),
    );
  }
  return out;
}

function collectAbsPaths(snapshot: RepoSnapshot): string[] {
  const out: string[] = [];
  for (const g of snapshot.groups) {
    for (const f of g.files) {
      out.push(f.path);
    }
  }
  for (const e of snapshot.amendHeadFiles ?? []) {
    out.push(e.path);
  }
  return out;
}

function sanitizeCssFamilyToken(id: string): string {
  return `commit-dock-fi-${id.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

export async function enrichRepoSnapshotFileIcons(
  webview: vscode.Webview,
  snapshot: RepoSnapshot,
): Promise<RepoSnapshot> {
  const active = getActiveFileIconTheme();
  if (!active) {
    return snapshot;
  }

  const themeJsonFsPath = active.themeJsonUri.fsPath;
  const themeBaseFs = path.dirname(themeJsonFsPath);

  const loaded = await loadCachedTheme(themeJsonFsPath);
  if (!loaded) {
    return snapshot;
  }
  const { resolver, doc } = loaded;

  const fonts = doc.fonts ?? [];
  const globalFontSize = fonts[0]?.size;
  const cssFamilyByFontId = new Map<string, string>();
  const fileIconFonts: FileIconFontFace[] = [];
  for (const f of fonts) {
    if (typeof f.id !== 'string' || !f.id) {
      continue;
    }
    const cssFamily = sanitizeCssFamilyToken(f.id);
    const picked = pickFontSrcFile(f);
    if (!picked) {
      continue;
    }
    const absFont = path.isAbsolute(picked.relPath)
      ? picked.relPath
      : path.join(themeBaseFs, picked.relPath.replace(/^\.\//, ''));
    if (!fs.existsSync(absFont)) {
      continue;
    }
    cssFamilyByFontId.set(f.id, cssFamily);
    const src = webview.asWebviewUri(vscode.Uri.file(absFont)).toString();
    fileIconFonts.push({
      cssFamily,
      src,
      format: formatMime(picked.format),
      weight: f.weight,
      style: f.style,
      size: f.size,
    });
  }

  const defaultFontId = fonts[0]?.id;

  const langs = await languageIdsForPaths(collectAbsPaths(snapshot));
  const isLight = [vscode.ColorThemeKind.Light, vscode.ColorThemeKind.HighContrastLight].includes(
    vscode.window.activeColorTheme.kind,
  );

  const mapResolved = (absPath: string, fallback: SnapshotFileIcon, resolved: ReturnType<FileIconThemeResolver['resolve']>): SnapshotFileIcon => {
    if (!resolved) {
      return fallback;
    }
    if (resolved.kind === 'image') {
      const absImg = path.isAbsolute(resolved.relativePath)
        ? resolved.relativePath
        : path.join(themeBaseFs, resolved.relativePath.replace(/^\.\//, ''));
      if (!fs.existsSync(absImg)) {
        return fallback;
      }
      return { kind: 'themeImage', src: webview.asWebviewUri(vscode.Uri.file(absImg)).toString() };
    }

    const fid = resolved.fontId ?? defaultFontId;
    const family = fid ? cssFamilyByFontId.get(fid) : undefined;
    if (!family) {
      return fallback;
    }
    return {
      kind: 'themeFont',
      family,
      codePoint: resolved.codePoint,
      color: resolved.color,
      fontSize: resolved.fontSize ?? globalFontSize,
    };
  };

  const mapFileIcon = (absPath: string, fallback: SnapshotFileIcon): SnapshotFileIcon => {
    const r = resolver.resolve(absPath, langs.get(absPath) ?? '', isLight);
    return mapResolved(absPath, fallback, r);
  };

  const groups = snapshot.groups.map((g) => ({
    ...g,
    files: g.files.map((f: SnapshotFile) => ({
      ...f,
      fileIcon: mapFileIcon(f.path, f.fileIcon),
    })),
  }));

  const amend: readonly AmendHeadFileEntry[] | undefined = snapshot.amendHeadFiles?.map((e) => ({
    ...e,
    fileIcon: mapFileIcon(e.path, e.fileIcon),
  }));

  return {
    ...snapshot,
    groups,
    amendHeadFiles: amend,
    fileIconFonts: fileIconFonts.length > 0 ? fileIconFonts : undefined,
  };
}
