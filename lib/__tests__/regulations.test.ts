import { describe, expect, it } from "vitest";
import {
  isRegulationsEmpty,
  regulationsForDisplay,
  safeLinkHref,
  sanitizeRegulations,
} from "../regulations";

const text = (t: string, marks?: unknown[]) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("safeLinkHref", () => {
  it("allows http, https and mailto", () => {
    expect(safeLinkHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeLinkHref("http://example.com")).toBe("http://example.com/");
    expect(safeLinkHref("mailto:organizer@example.com")).toBe("mailto:organizer@example.com");
  });

  it("rejects script-capable and relative links", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "ftp://x.com/f", "/relative", "example.com", "", "  "]) {
      expect(safeLinkHref(bad)).toBeNull();
    }
    expect(safeLinkHref(42)).toBeNull();
    expect(safeLinkHref(undefined)).toBeNull();
  });
});

describe("sanitizeRegulations", () => {
  it("keeps a normal document intact", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Rules")] },
      para(text("Read "), text("this", [{ type: "bold" }, { type: "italic" }]), text(" carefully.")),
      { type: "bulletList", content: [{ type: "listItem", content: [para(text("Be on time"))] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [para(text("Warm up"))] }] },
      { type: "blockquote", content: [para(text("Quote"))] },
      { type: "horizontalRule" },
    );
    expect(sanitizeRegulations(input)).toEqual(input);
  });

  it("rejects anything that isn't a doc", () => {
    for (const bad of [null, undefined, "text", 5, [], { type: "paragraph" }, { content: [] }]) {
      expect(sanitizeRegulations(bad)).toBeNull();
    }
  });

  it("drops unknown nodes (raw HTML, scripts, images, code blocks)", () => {
    const cleaned = sanitizeRegulations(
      doc(
        { type: "script", content: [text("alert(1)")] },
        { type: "image", attrs: { src: "https://x.test/a.png" } },
        { type: "codeBlock", content: [text("x")] },
        { type: "html", html: "<img src=x onerror=alert(1)>" },
        para(text("safe")),
      ),
    );
    expect(cleaned).toEqual(doc(para(text("safe"))));
  });

  it("drops unknown marks and unsafe links but keeps the text", () => {
    const cleaned = sanitizeRegulations(
      doc(
        para(
          text("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]),
          text("ok", [{ type: "link", attrs: { href: "https://example.com", target: "_self", onclick: "x()" } }]),
          text("weird", [{ type: "highlight" }, { type: "bold" }]),
        ),
      ),
    );
    expect(cleaned).toEqual(
      doc(
        para(
          text("bad"),
          text("ok", [{ type: "link", attrs: { href: "https://example.com/" } }]),
          text("weird", [{ type: "bold" }]),
        ),
      ),
    );
  });

  it("strips unexpected attributes and clamps heading levels", () => {
    const cleaned = sanitizeRegulations(
      doc({ type: "heading", attrs: { level: 1, style: "x" }, content: [text("H")] }, { type: "heading", attrs: { level: 3 }, content: [text("h")] }),
    );
    expect(cleaned).toEqual(
      doc({ type: "heading", attrs: { level: 2 }, content: [text("H")] }, { type: "heading", attrs: { level: 3 }, content: [text("h")] }),
    );
  });

  it("refuses absurdly deep or oversized documents' excess", () => {
    let deep: unknown = para(text("x"));
    for (let i = 0; i < 40; i++) deep = { type: "blockquote", content: [deep] };
    const cleaned = sanitizeRegulations(doc(deep));
    expect(JSON.stringify(cleaned)).not.toContain('"x"');

    const big = sanitizeRegulations(doc(para(text("a".repeat(60_000))), para(text("b".repeat(60_000)))));
    expect(JSON.stringify(big)).toContain("aaaa");
    expect(JSON.stringify(big)).not.toContain("bbbb");
  });
});

describe("isRegulationsEmpty / regulationsForDisplay", () => {
  it("treats no text as empty", () => {
    expect(isRegulationsEmpty(null)).toBe(true);
    expect(isRegulationsEmpty(sanitizeRegulations(doc()))).toBe(true);
    expect(isRegulationsEmpty(sanitizeRegulations(doc(para(), para(text("   ")))))).toBe(true);
    expect(isRegulationsEmpty(sanitizeRegulations(doc(para(text("Hi")))))).toBe(false);
  });

  it("finds text nested in lists", () => {
    const nested = doc({ type: "bulletList", content: [{ type: "listItem", content: [para(text("Item"))] }] });
    expect(isRegulationsEmpty(sanitizeRegulations(nested))).toBe(false);
  });

  it("returns null for empty or garbage stored values, a clean doc otherwise", () => {
    expect(regulationsForDisplay(null)).toBeNull();
    expect(regulationsForDisplay({ type: "doc", content: [] })).toBeNull();
    expect(regulationsForDisplay("<script>")).toBeNull();
    expect(regulationsForDisplay(doc(para(text("Hi"))))).toEqual(doc(para(text("Hi"))));
  });
});
