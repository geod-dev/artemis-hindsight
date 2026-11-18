"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// A mental model's content: the markdown Hindsight writes (headings, lists, bold). Raw HTML is not rendered.

const components: Components = {
  h1: ({ children }) => <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 text-sm font-medium first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-3 text-sm font-medium first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-2 leading-relaxed first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1 align-top">{children}</td>,
};

export function MemoryMarkdown({ children }: { children: string }) {
  return (
    <div className="text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
