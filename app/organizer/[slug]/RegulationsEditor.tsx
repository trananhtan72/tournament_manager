"use client";

import { useActionState, useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { updateRegulations, type RegulationsActionState } from "@/app/actions/tournaments";
import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { SubmitButton } from "@/components/SubmitButton";
import { safeLinkHref, type RegulationsDoc } from "@/lib/regulations";

const initialState: RegulationsActionState = {};

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded-md px-2 py-1 text-sm disabled:opacity-40 ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-text hover:bg-surface-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function RegulationsEditor({
  tournamentId,
  initialDoc,
  onDone,
}: {
  tournamentId: string;
  initialDoc: RegulationsDoc | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(updateRegulations.bind(null, tournamentId), initialState);
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    // Only what lib/regulations.ts allows: no code, strike-through or images.
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
        link: { openOnClick: false, autolink: false },
      }),
    ],
    content: initialDoc ?? undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Regulations text",
        class:
          "min-h-64 max-h-[50vh] overflow-y-auto rounded-b-md border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-text outline-none focus:border-primary " +
          "[&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_a]:underline [&_hr]:my-3",
      },
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      underline: editor?.isActive("underline") ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      h3: editor?.isActive("heading", { level: 3 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      blockquote: editor?.isActive("blockquote") ?? false,
      link: editor?.isActive("link") ?? false,
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false,
    }),
  });

  useEffect(() => {
    if (state.saved) onDone();
  }, [state, onDone]);

  function toggleLink() {
    if (!editor) return;
    setLinkError(null);
    if (active?.link) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const entered = window.prompt("Link address (https://…)", "https://");
    if (entered === null || entered.trim() === "") return;
    const href = safeLinkHref(entered);
    if (!href) {
      setLinkError("Links must start with http://, https:// or mailto:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  const chain = () => editor?.chain().focus();

  return (
    <form
      action={() => {
        if (!editor) return;
        const formData = new FormData();
        formData.set("regulations", JSON.stringify(editor.getJSON()));
        formAction(formData);
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col">
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-border bg-surface-muted px-2 py-1"
        >
          <ToolbarButton label="Bold" active={active?.bold} onClick={() => chain()?.toggleBold().run()}>
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton label="Italic" active={active?.italic} onClick={() => chain()?.toggleItalic().run()}>
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton label="Underline" active={active?.underline} onClick={() => chain()?.toggleUnderline().run()}>
            <u>U</u>
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton label="Heading" active={active?.h2} onClick={() => chain()?.toggleHeading({ level: 2 }).run()}>
            H2
          </ToolbarButton>
          <ToolbarButton label="Subheading" active={active?.h3} onClick={() => chain()?.toggleHeading({ level: 3 }).run()}>
            H3
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton label="Bulleted list" active={active?.bulletList} onClick={() => chain()?.toggleBulletList().run()}>
            • List
          </ToolbarButton>
          <ToolbarButton label="Numbered list" active={active?.orderedList} onClick={() => chain()?.toggleOrderedList().run()}>
            1. List
          </ToolbarButton>
          <ToolbarButton label="Quote" active={active?.blockquote} onClick={() => chain()?.toggleBlockquote().run()}>
            “ ”
          </ToolbarButton>
          <ToolbarButton label="Divider line" onClick={() => chain()?.setHorizontalRule().run()}>
            ―
          </ToolbarButton>
          <ToolbarButton label={active?.link ? "Remove link" : "Add link"} active={active?.link} onClick={toggleLink}>
            Link
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolbarButton label="Undo" disabled={!active?.canUndo} onClick={() => chain()?.undo().run()}>
            ↶
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!active?.canRedo} onClick={() => chain()?.redo().run()}>
            ↷
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} />
      </div>
      {linkError && (
        <p role="alert" className="text-sm text-error">
          {linkError}
        </p>
      )}
      <FormError message={state.error} />
      <p className="text-xs text-muted">
        Players read this exactly as formatted here, in a popup on the tournament page. Clear all the text and
        save to remove the regulations.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">Save regulations</SubmitButton>
      </div>
    </form>
  );
}
