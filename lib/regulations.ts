// The regulations document is edited as rich text (Tiptap/ProseMirror JSON)
// but never trusted: everything read from a form or the database goes through
// sanitizeRegulations, which rebuilds the document from an allowlist of node
// and mark types. Anything else — scripts, raw HTML, unknown nodes, unsafe
// link protocols — is dropped, so what the renderer sees can't inject markup.

export type RegulationsMark =
  | { type: "bold" | "italic" | "underline" }
  | { type: "link"; attrs: { href: string } };

export type RegulationsNode =
  | { type: "text"; text: string; marks?: RegulationsMark[] }
  | { type: "hardBreak" | "horizontalRule" }
  | { type: "paragraph"; content?: RegulationsNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RegulationsNode[] }
  | { type: "bulletList" | "orderedList" | "blockquote" | "listItem"; content: RegulationsNode[] };

export type RegulationsDoc = { type: "doc"; content: RegulationsNode[] };

export const MAX_REGULATIONS_JSON_LENGTH = 300_000;
const MAX_DEPTH = 12;
const MAX_NODES = 20_000;
const MAX_TEXT_LENGTH = 100_000;

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** The href to store, or null if it isn't an absolute http(s)/mailto link. */
export function safeLinkHref(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 2000) return null;
  try {
    const url = new URL(href.trim());
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

type Budget = { nodes: number; textLength: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function cleanMarks(raw: unknown): RegulationsMark[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const marks: RegulationsMark[] = [];
  for (const mark of raw) {
    if (!isRecord(mark)) continue;
    if (mark.type === "bold" || mark.type === "italic" || mark.type === "underline") {
      if (!marks.some((m) => m.type === mark.type)) marks.push({ type: mark.type });
    } else if (mark.type === "link" && isRecord(mark.attrs)) {
      const href = safeLinkHref(mark.attrs.href);
      if (href && !marks.some((m) => m.type === "link")) marks.push({ type: "link", attrs: { href } });
    }
  }
  return marks.length > 0 ? marks : undefined;
}

function cleanChildren(raw: unknown, depth: number, budget: Budget): RegulationsNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((child) => cleanNode(child, depth + 1, budget) ?? []);
}

function cleanNode(raw: unknown, depth: number, budget: Budget): RegulationsNode | null {
  if (!isRecord(raw) || depth > MAX_DEPTH || ++budget.nodes > MAX_NODES) return null;

  switch (raw.type) {
    case "text": {
      if (typeof raw.text !== "string" || raw.text === "") return null;
      budget.textLength += raw.text.length;
      if (budget.textLength > MAX_TEXT_LENGTH) return null;
      const marks = cleanMarks(raw.marks);
      return marks ? { type: "text", text: raw.text, marks } : { type: "text", text: raw.text };
    }
    case "hardBreak":
    case "horizontalRule":
      return { type: raw.type };
    case "paragraph":
      return { type: "paragraph", content: cleanChildren(raw.content, depth, budget) };
    case "heading": {
      const level = isRecord(raw.attrs) && raw.attrs.level === 3 ? 3 : 2;
      return { type: "heading", attrs: { level }, content: cleanChildren(raw.content, depth, budget) };
    }
    case "bulletList":
    case "orderedList":
    case "blockquote":
    case "listItem":
      return { type: raw.type, content: cleanChildren(raw.content, depth, budget) };
    default:
      return null;
  }
}

/** Rebuilds `input` as a safe document, or returns null if it isn't a document at all. */
export function sanitizeRegulations(input: unknown): RegulationsDoc | null {
  if (!isRecord(input) || input.type !== "doc") return null;
  const budget: Budget = { nodes: 0, textLength: 0 };
  return { type: "doc", content: cleanChildren(input.content, 0, budget) };
}

function hasText(nodes: RegulationsNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === "text") return node.text.trim() !== "";
    return "content" in node && node.content ? hasText(node.content) : false;
  });
}

/** True when there's nothing to read — no text anywhere (an empty editor or only blank lines). */
export function isRegulationsEmpty(doc: RegulationsDoc | null): boolean {
  return !doc || !hasText(doc.content);
}

/** A stored value (untrusted JSON from the database) as a document worth showing, or null. */
export function regulationsForDisplay(stored: unknown): RegulationsDoc | null {
  const doc = sanitizeRegulations(stored);
  return doc && !isRegulationsEmpty(doc) ? doc : null;
}
