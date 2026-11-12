// Regenerates the body path in public/mascot/definition.json.
//
// The body is a circle whose radius wobbles with a cosine: `lobes` soft bumps around the rim, each `amp` units
// in or out from `base`. Lower `amp` means less variation along the edge, so fewer spikes.
//
//   node scripts/mascot-body.mjs                                   # the current defaults
//   node scripts/mascot-body.mjs --lobes 7 --amp 1.5 --base 36 --points 360
//
// Keeps id, name, version and eyes from the existing file. Writes only if the result passes validateAvatar.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateAvatar } from "open-bot-avatar";

const file = fileURLToPath(new URL("../public/mascot/definition.json", import.meta.url));

const options = { lobes: 7, amp: 1.5, base: 36, points: 360, cx: 50, cy: 50 };

for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, "");
  if (!(key in options)) throw new Error(`unknown option --${key}`);
  const value = Number(process.argv[i + 1]);
  if (!Number.isFinite(value)) throw new Error(`--${key} needs a number`);
  options[key] = value;
}

const { lobes, amp, base, points, cx, cy } = options;
const round = (v) => String(Number(v.toFixed(2)));

const coords = Array.from({ length: points }, (_, i) => {
  const t = (i / points) * 2 * Math.PI;
  const r = base + amp * Math.cos(lobes * t);
  return `${round(cx + r * Math.cos(t))} ${round(cy + r * Math.sin(t))}`;
});
const path = `M${coords.join("L")}Z`;

const definition = JSON.parse(readFileSync(file, "utf8"));
definition.body = { path };

const result = validateAvatar(definition);
if (!result.ok) {
  console.error(JSON.stringify(result.errors));
  process.exit(1);
}

writeFileSync(file, `${JSON.stringify(definition, null, 2)}\n`);
console.log(`wrote ${file} (lobes ${lobes}, amp ${amp}, base ${base}, ${points} points)`);
