// Writes the favicons from the chat avatar. The shape comes from public/avatar/definition.json, the same file the
// app draws, so the icon matches the avatar. Run it again after the avatar changes:
//   node scripts/generate-favicons.mjs
//
// The colors are the theme's: the body is --primary (blue in light mode, the foreground in dark mode) and the eyes
// take --background, the same rule as components/avatar/bot-avatar.tsx.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avatarFrame } from "open-bot-avatar";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definition = JSON.parse(readFileSync(path.join(webRoot, "public/avatar/definition.json"), "utf8"));

const THEMES = {
  // Light browser theme: blue body (#2f6ce6 = --primary) with white eyes (--background oklch(1)).
  light: { body: "#2f6ce6", eyes: "#ffffff" },
  // Dark browser theme: near-white body (--foreground oklch(0.985)) with near-black eyes (--background oklch(0.145)).
  dark: { body: "#fbfbfb", eyes: "#0a0a0a" },
};

function svgFor({ body, eyes }) {
  // The face plane's transform: the eyes and the front of the body share it, so the features line up with the outline.
  const frame = avatarFrame(definition, { color: body, eyeColor: eyes });
  const eyeShapes = frame.shapes.filter((s) => s.kind === "eye");
  if (eyeShapes.length !== 2) throw new Error(`expected 2 eyes, got ${eyeShapes.length}`);
  const [a, b, c, d, e, f] = eyeShapes[0].matrix;
  const matrix = `matrix(${[a, b, c, d, e, f].map((n) => Number(n.toFixed(4))).join(" ")})`;
  const pills = eyeShapes
    .map(({ mark }) => `<rect x="${mark.x.toFixed(3)}" y="${mark.y.toFixed(3)}" width="${mark.width}" height="${mark.height}" rx="${mark.radius}" fill="${eyes}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<g transform="${matrix}"><path d="${definition.body.path}" fill="${body}"/>${pills}</g>` +
    `</svg>\n`
  );
}

for (const [name, colors] of Object.entries(THEMES)) {
  const file = path.join(webRoot, "public", `favicon-${name}.svg`);
  writeFileSync(file, svgFor(colors));
  console.log("wrote", path.relative(webRoot, file));
}
