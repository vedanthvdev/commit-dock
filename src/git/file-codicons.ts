import * as path from 'path';

const DEFAULT = 'codicon codicon-symbol-file';

const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'avif',
  'svg',
]);

const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar']);

const BINARY_EXT = new Set(['exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'lib', 'wasm']);

const CODE_EXT = new Set([
  'ts',
  'tsx',
  'mts',
  'cts',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'c',
  'cc',
  'cxx',
  'cpp',
  'h',
  'hh',
  'hpp',
  'hxx',
  'java',
  'kt',
  'kts',
  'swift',
  'rs',
  'go',
  'php',
  'pl',
  'pm',
  'lua',
  'r',
  'scala',
  'sc',
  'dart',
  'elm',
  'ex',
  'exs',
  'erl',
  'hrl',
  'fs',
  'fsi',
  'fsx',
  'vb',
  'cs',
  'coffee',
  'clj',
  'cljs',
  'edn',
  'nim',
  'zig',
  'odin',
  'vala',
  'v',
  'sv',
  'vhdl',
  'vhd',
  'astro',
  'vue',
  'svelte',
  'html',
  'htm',
  'xhtml',
  'css',
  'scss',
  'sass',
  'less',
  'styl',
  'xml',
  'xsd',
  'xsl',
  'xslt',
  'wsdl',
  'plist',
  'graphql',
  'gql',
  'mdx',
]);

const TEXT_EXT = new Set([
  'txt',
  'log',
  'csv',
  'tsv',
  'yml',
  'yaml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'config',
  'properties',
  'env',
  'editorconfig',
  'gitattributes',
  'gitmodules',
  'mod',
  'sum',
  'gradle',
  'props',
  'targets',
  'nuspec',
]);

/** Full codicon class list (`codicon codicon-…`) for a file path, approximating SCM file-type icons. */
export function fileCodiconFromPath(fsPath: string): string {
  const lower = fsPath.toLowerCase();
  const base = path.basename(lower);
  const ext = path.extname(lower).replace(/^\./, '');

  if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
    return 'codicon codicon-file-code';
  }
  if (base === '.dockerignore') {
    return 'codicon codicon-file-text';
  }
  if (base === '.gitignore' || base === '.gitattributes' || base === '.gitmodules') {
    return 'codicon codicon-diff-ignored';
  }
  if (/^readme\./i.test(base)) {
    if (ext === 'md' || ext === 'markdown') {
      return 'codicon codicon-markdown';
    }
    return 'codicon codicon-file-text';
  }
  if (/^readme$/i.test(base)) {
    return 'codicon codicon-file-text';
  }
  if (base === 'license' || base === 'copying' || base === 'changelog' || base === 'contributing') {
    return 'codicon codicon-file-text';
  }
  if (base === 'makefile' || base === 'gnumakefile' || base.endsWith('makefile')) {
    return 'codicon codicon-file-text';
  }
  if (base === 'gemfile' || base === 'rakefile' || base === 'podfile' || base === 'brewfile' || base.endsWith('.gemspec')) {
    return 'codicon codicon-ruby';
  }
  if (
    base.endsWith('.lock') ||
    base === 'package-lock.json' ||
    base === 'yarn.lock' ||
    base === 'pnpm-lock.yaml' ||
    base === 'cargo.lock' ||
    base === 'composer.lock' ||
    base === 'podfile.lock' ||
    base === 'gemfile.lock'
  ) {
    return 'codicon codicon-lock';
  }
  if (ext === 'pem' || ext === 'crt' || ext === 'cer' || ext === 'p12' || ext === 'pfx' || ext === 'key') {
    return 'codicon codicon-key';
  }
  if (ext === 'woff' || ext === 'woff2' || ext === 'ttf' || ext === 'otf' || ext === 'eot') {
    return 'codicon codicon-file-media';
  }
  if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'flac' || ext === 'm4a' || ext === 'aac') {
    return 'codicon codicon-file-media';
  }
  if (ext === 'mp4' || ext === 'webm' || ext === 'mov' || ext === 'mkv' || ext === 'avi' || ext === 'm4v') {
    return 'codicon codicon-file-media';
  }

  if (IMAGE_EXT.has(ext)) {
    return 'codicon codicon-file-media';
  }
  if (ARCHIVE_EXT.has(ext)) {
    return 'codicon codicon-file-zip';
  }
  if (ext === 'pdf') {
    return 'codicon codicon-file-pdf';
  }
  if (BINARY_EXT.has(ext)) {
    return 'codicon codicon-file-binary';
  }

  const shellish = new Set(['sh', 'bash', 'zsh', 'fish', 'ksh']);
  if (shellish.has(ext)) {
    return 'codicon codicon-terminal-bash';
  }
  if (ext === 'ps1' || ext === 'psm1' || ext === 'psd1') {
    return 'codicon codicon-terminal-powershell';
  }
  if (ext === 'bat' || ext === 'cmd') {
    return 'codicon codicon-terminal-cmd';
  }

  if (ext === 'json' || ext === 'jsonc') {
    return 'codicon codicon-json';
  }
  if (ext === 'md') {
    return 'codicon codicon-markdown';
  }
  if (ext === 'py' || ext === 'pyi' || ext === 'pyw') {
    return 'codicon codicon-python';
  }
  if (ext === 'rb') {
    return 'codicon codicon-ruby';
  }
  if (ext === 'sql' || ext === 'sqlite' || ext === 'db') {
    return 'codicon codicon-database';
  }

  if (CODE_EXT.has(ext)) {
    return 'codicon codicon-file-code';
  }
  if (TEXT_EXT.has(ext)) {
    return 'codicon codicon-file-text';
  }

  if (!ext) {
    return DEFAULT;
  }

  return DEFAULT;
}
