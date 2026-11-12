// Writes the favicons from the mascot. The shape comes from public/mascot/definition.json and the colors from the
// theme tokens in src/app/globals.css, the same values the app draws with. Run it again after either changes:
//   node scripts/generate-favicons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avatarFrame } from "open-bot-avatar";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const definition = JSON.parse(readFileSync(path.join(webRoot, "public/mascot/definition.json"), "utf8"));
const css = readFileSync(path.join(webRoot, "src/app/globals.css"), "utf8");

function block(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`${selector} not found in globals.css`);
  return css.slice(start, css.indexOf("}", start));
}

const lightTokens = block(":root,\n.light {");
const darkTokens = block(".dark {");

function tokenIn(tokens, name) {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--${name} not found`);
  return match[1].trim();
}

// A token that points at another token (--primary is var(--foreground) in dark mode) is resolved against the dark block.
function resolve(tokens, name) {
  const value = tokenIn(tokens, name);
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  return reference ? resolve(darkTokens, reference[1]) : value;
}

// OKLCH with zero chroma is gray: linear light is L cubed, then the sRGB transfer curve. Exact, no color library.
function toHex(value) {
  if (value.startsWith("#")) return value;
  const gray = value.match(/^oklch\(\s*([\d.]+)\s+0\s+0\s*\)$/);
  if (!gray) throw new Error(`unsupported color for a favicon: ${value}`);
  const linear = Number(gray[1]) ** 3;
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  return `#${byte.toString(16).padStart(2, "0").repeat(3)}`;
}

// The flat, front-on mascot: the eye marks are in the shape's own coordinates. The 3D view's tilt (the matrix on each
// eye) is left out on purpose, so the icon is centered with level eyes.
function svgFor({ body, eyes }) {
  const frame = avatarFrame(definition, { color: body, eyeColor: eyes });
  const eyeShapes = frame.shapes.filter((s) => s.kind === "eye");
  if (eyeShapes.length !== 2) throw new Error(`expected 2 eyes, got ${eyeShapes.length}`);
  const { x, y, spacing } = definition.eyes;
  const centers = [x - spacing / 2, x + spacing / 2];
  const pills = eyeShapes
    .map(({ mark }, i) => {
      const cx = centers[i];
      return `<rect x="${(cx - mark.width / 2).toFixed(3)}" y="${(y - mark.height / 2).toFixed(3)}" width="${mark.width}" height="${mark.height}" rx="${mark.radius}" fill="${eyes}"/>`;
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<path d="${definition.body.path}" fill="${body}"/>${pills}` +
    `</svg>\n`
  );
}

const themes = {
  light: { body: toHex(resolve(lightTokens, "primary")), eyes: toHex(resolve(lightTokens, "background")) },
  dark: { body: toHex(resolve(darkTokens, "primary")), eyes: toHex(resolve(darkTokens, "background")) },
};

for (const [name, colors] of Object.entries(themes)) {
  const file = path.join(webRoot, "public", `favicon-${name}.svg`);
  writeFileSync(file, svgFor(colors));
  console.log(`wrote public/favicon-${name}.svg`, colors);
}
