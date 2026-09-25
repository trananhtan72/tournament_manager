import type { ReactNode } from "react";
import type { RegulationsDoc, RegulationsMark, RegulationsNode } from "@/lib/regulations";

function applyMarks(text: string, marks: RegulationsMark[] | undefined): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "underline") out = <u>{out}</u>;
    else if (mark.type === "link") {
      const external = mark.attrs.href.startsWith("http");
      out = (
        <a
          href={mark.attrs.href}
          className="underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {out}
        </a>
      );
    }
  }
  return out;
}

function renderNodes(nodes: RegulationsNode[] | undefined): ReactNode {
  return (nodes ?? []).map((node, i) => renderNode(node, i));
}

function renderNode(node: RegulationsNode, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return <span key={key}>{applyMarks(node.text, node.marks)}</span>;
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} className="border-slate-200 dark:border-slate-700" />;
    case "paragraph":
      return (
        <p key={key} className="min-h-[1lh]">
          {renderNodes(node.content)}
        </p>
      );
    case "heading":
      return node.attrs.level === 2 ? (
        <h2 key={key} className="mt-2 text-lg font-semibold">
          {renderNodes(node.content)}
        </h2>
      ) : (
        <h3 key={key} className="mt-1 text-base font-semibold">
          {renderNodes(node.content)}
        </h3>
      );
    case "bulletList":
      return (
        <ul key={key} className="list-disc pl-6">
          {renderNodes(node.content)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal pl-6">
          {renderNodes(node.content)}
        </ol>
      );
    case "listItem":
      return (
        <li key={key} className="[&>p]:min-h-0">
          {renderNodes(node.content)}
        </li>
      );
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-slate-300 pl-4 text-slate-600 dark:border-slate-600 dark:text-slate-400">
          {renderNodes(node.content)}
        </blockquote>
      );
  }
}

/** Renders a sanitized regulations document (see lib/regulations.ts). */
export function RegulationsContent({ doc }: { doc: RegulationsDoc }) {
  return <div className="flex flex-col gap-3 text-sm leading-relaxed">{renderNodes(doc.content)}</div>;
}
