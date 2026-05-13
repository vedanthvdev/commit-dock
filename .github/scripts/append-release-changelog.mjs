/**
 * Insert a new ## [version] - date section before the first existing ## [x.y.z] release.
 * Usage: node .github/scripts/append-release-changelog.mjs
 * Env: RELEASE_VERSION, RELEASE_DATE, PR_NUMBER, PR_TITLE, PR_URL, CHANGELOG_PATH (optional)
 */
import fs from "node:fs";

const version = process.env.RELEASE_VERSION ?? "";
const date = process.env.RELEASE_DATE ?? "";
const prNumber = process.env.PR_NUMBER ?? "";
const prTitle = process.env.PR_TITLE ?? "";
const prUrl = process.env.PR_URL ?? "";
const path = process.env.CHANGELOG_PATH ?? "CHANGELOG.md";

if (!version || !date) {
  console.error("RELEASE_VERSION and RELEASE_DATE are required.");
  process.exit(1);
}

const prLine =
  prNumber && prUrl
    ? `- [#${prNumber}](${prUrl}): ${prTitle.replace(/\r?\n/g, " ").trim() || "Merged pull request"}`
    : `- ${prTitle.replace(/\r?\n/g, " ").trim() || "Release"}`;

const block = `
## [${version}] - ${date}

### Changed

${prLine}
`;

let text = fs.readFileSync(path, "utf8");
const versionHeading = `## [${version}]`;
if (text.includes(versionHeading)) {
  console.error(`CHANGELOG already contains ${version}; aborting to avoid duplicates.`);
  process.exit(2);
}

const anchor = /\n## \[\d+\.\d+\.\d+\] - /;
const match = anchor.exec(text);
if (match) {
  const idx = match.index;
  text = text.slice(0, idx) + block + text.slice(idx);
} else {
  text += `\n${block.trim()}\n`;
}

fs.writeFileSync(path, text, "utf8");
console.log(`Prepended CHANGELOG section for ${version}.`);
