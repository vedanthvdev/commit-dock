/**
 * Print the next SemVer for a bump kind. Usage:
 *   node .github/scripts/next-version.mjs <current> <patch|minor|major>
 */
const cur = process.argv[2] ?? "";
const kind = process.argv[3] ?? "";
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(cur.trim());
if (!m) {
  console.error("Invalid version:", cur);
  process.exit(1);
}
let major = Number(m[1]);
let minor = Number(m[2]);
let patch = Number(m[3]);
if (kind === "patch") patch += 1;
else if (kind === "minor") {
  minor += 1;
  patch = 0;
} else if (kind === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else {
  console.error("Invalid kind:", kind);
  process.exit(1);
}
console.log(`${major}.${minor}.${patch}`);
