// Syntax highlighting of the code blocks in a reply. The same highlighter as the web app (Shiki, with the same GitHub
// themes), so the colours match services/web/src/components/assistant-ui/elements/shiki-highlighter.tsx and
// services/web/src/components/chat/code-block.tsx. Shiki has hundreds of grammars: the phone ships the common ones only,
// each loaded the first time a block needs it. A fence it does not list is shown as plain code, as the web shows its
// unknown ones.
import { createHighlighterCore, type HighlighterCore, type ThemedToken } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

type LanguageInput = Parameters<HighlighterCore["loadLanguage"]>[0];
type Loader = () => Promise<{ default: LanguageInput }>;

// The grammars, by Shiki's id. The engine targets ES2018 so Hermes can run the regular expressions.
const GRAMMARS: Record<string, Loader> = {
  typescript: () => import("shiki/dist/langs/typescript.mjs"),
  tsx: () => import("shiki/dist/langs/tsx.mjs"),
  javascript: () => import("shiki/dist/langs/javascript.mjs"),
  jsx: () => import("shiki/dist/langs/jsx.mjs"),
  json: () => import("shiki/dist/langs/json.mjs"),
  python: () => import("shiki/dist/langs/python.mjs"),
  shellscript: () => import("shiki/dist/langs/shellscript.mjs"),
  powershell: () => import("shiki/dist/langs/powershell.mjs"),
  sql: () => import("shiki/dist/langs/sql.mjs"),
  yaml: () => import("shiki/dist/langs/yaml.mjs"),
  markdown: () => import("shiki/dist/langs/markdown.mjs"),
  html: () => import("shiki/dist/langs/html.mjs"),
  css: () => import("shiki/dist/langs/css.mjs"),
  scss: () => import("shiki/dist/langs/scss.mjs"),
  go: () => import("shiki/dist/langs/go.mjs"),
  rust: () => import("shiki/dist/langs/rust.mjs"),
  java: () => import("shiki/dist/langs/java.mjs"),
  kotlin: () => import("shiki/dist/langs/kotlin.mjs"),
  swift: () => import("shiki/dist/langs/swift.mjs"),
  c: () => import("shiki/dist/langs/c.mjs"),
  cpp: () => import("shiki/dist/langs/cpp.mjs"),
  csharp: () => import("shiki/dist/langs/csharp.mjs"),
  php: () => import("shiki/dist/langs/php.mjs"),
  ruby: () => import("shiki/dist/langs/ruby.mjs"),
  diff: () => import("shiki/dist/langs/diff.mjs"),
  xml: () => import("shiki/dist/langs/xml.mjs"),
  dockerfile: () => import("shiki/dist/langs/dockerfile.mjs"),
  toml: () => import("shiki/dist/langs/toml.mjs"),
  graphql: () => import("shiki/dist/langs/graphql.mjs"),
  lua: () => import("shiki/dist/langs/lua.mjs"),
  dart: () => import("shiki/dist/langs/dart.mjs"),
};

// The fence names a reply uses for each grammar (lower case, as the web lowercases them).
const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  bash: "shellscript",
  sh: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  ps1: "powershell",
  yml: "yaml",
  md: "markdown",
  rs: "rust",
  kt: "kotlin",
  "c++": "cpp",
  cs: "csharp",
  "c#": "csharp",
  rb: "ruby",
  docker: "dockerfile",
};

const THEMES = { dark: "github-dark-default", light: "github-light-default" } as const;

/** The Shiki grammar for a fence, or undefined when the phone does not ship it (the block is then plain). */
export function grammarOf(fence: string): string | undefined {
  const id = fence.trim().toLowerCase();
  const grammar = ALIASES[id] ?? id;
  return Object.hasOwn(GRAMMARS, grammar) ? grammar : undefined;
}

let highlighter: Promise<HighlighterCore> | undefined;
const loading = new Map<string, Promise<void>>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= Promise.all([
    import("shiki/dist/themes/github-dark-default.mjs"),
    import("shiki/dist/themes/github-light-default.mjs"),
  ]).then(([dark, light]) =>
    createHighlighterCore({
      engine: createJavaScriptRegexEngine({ target: "ES2018" }),
      themes: [dark.default, light.default],
      langs: [],
    }),
  );
  return highlighter;
}

function ensureGrammar(core: HighlighterCore, grammar: string): Promise<void> {
  let pending = loading.get(grammar);
  if (!pending) {
    pending = GRAMMARS[grammar]!().then((module) => core.loadLanguage(module.default));
    loading.set(grammar, pending);
    // A failed load is forgotten, so the next block with this language tries again.
    pending.catch(() => loading.delete(grammar));
  }
  return pending;
}

// The last highlighted blocks: a block re-rendered in the list (or scrolled back into view) is not tokenized again.
const RESULTS_KEPT = 80;
const results = new Map<string, ThemedToken[][]>();

/**
 * The coloured tokens of a code block, one array per line, or undefined when the fence has no grammar here. Resolves
 * with the tokens of the given light or dark theme.
 */
export async function highlightCode(code: string, fence: string, dark: boolean): Promise<ThemedToken[][] | undefined> {
  const grammar = grammarOf(fence);
  if (!grammar) return undefined;
  const key = `${dark ? "dark" : "light"}|${grammar}|${code}`;
  const cached = results.get(key);
  if (cached) return cached;

  const core = await getHighlighter();
  await ensureGrammar(core, grammar);
  const tokens = await core.codeToTokensBase(code, { lang: grammar, theme: dark ? THEMES.dark : THEMES.light });

  if (results.size >= RESULTS_KEPT) results.delete(results.keys().next().value!);
  results.set(key, tokens);
  return tokens;
}
