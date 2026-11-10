// Downloads assistant-ui registry items (and their registry dependencies) and writes each file
// to the path the registry declares, under services/web/src. Run from services/web.
//
// Usage:
//   node scripts/sync-assistant-ui.mjs --dry <item>...   # list files only
//   node scripts/sync-assistant-ui.mjs <item>...         # write files
//
// Item names are registry names, e.g. "thread", "elements-run-activity", "elements-tool-call".
// See CLAUDE.md before re-running: it overwrites files, including any local edits.
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const dry = args[0] === "--dry";
if (dry) args.shift();
const roots = args;

if (roots.length === 0) {
  console.error("usage: node scripts/sync-assistant-ui.mjs [--dry] <item>...");
  process.exit(1);
}

const appRoot = process.cwd();
const seen = new Set();
const queue = [...roots];
const files = new Map();

while (queue.length > 0) {
  const name = queue.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const res = await fetch(`https://r.assistant-ui.com/${name}.json`);
  if (!res.ok) {
    console.error(`skip ${name}: HTTP ${res.status}`);
    continue;
  }
  const item = await res.json();
  for (const dep of item.registryDependencies ?? []) {
    const match = /r\.assistant-ui\.com\/([^/]+)\.json$/.exec(dep);
    if (match) queue.push(match[1]);
  }
  for (const file of item.files ?? []) {
    files.set(file.path, file.content);
  }
}

for (const [registryPath, content] of files) {
  if (dry) {
    console.log(`${registryPath}  (${content?.length ?? 0} chars)`);
    continue;
  }
  const target = path.join(appRoot, "src", registryPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content ?? "", "utf8");
  console.log(`wrote src/${registryPath}`);
}
console.log(`items: ${seen.size}, files: ${files.size}`);
