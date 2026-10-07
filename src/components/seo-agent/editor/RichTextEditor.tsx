"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, List, ListOrdered, Quote, Minus, Link2, Link2Off, ImagePlus, Table2, Undo2, Redo2,
  Pilcrow, Heading1, Heading2, Heading3, Megaphone, Rows3, Columns3, Trash2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CTA_LABELS, CTA_TYPES, type CtaType } from "@/lib/seo-agent/constants";
import { cn } from "@/lib/utils";
import { CtaBlock } from "./cta-block";
import "./article-prose.css";

interface Props {
  initialHtml: string;
  editable: boolean;
  defaultCta: CtaType;
  onChange: (html: string) => void;
}

/** TipTap editor for SEO articles. Output is sanitized again on the server. */
export function RichTextEditor({ initialHtml, editable, defaultCta, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: null, target: null } },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ inline: false, allowBase64: false }),
      CtaBlock,
    ],
    content: initialHtml,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "seo-prose min-h-[480px] px-1 py-2", "aria-label": "Article body" } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return <div className="min-h-[480px]" aria-busy />;

  return (
    <div className="flex flex-col gap-2">
      {editable && <Toolbar editor={editor} defaultCta={defaultCta} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Btn({ onClick, active, disabled, label, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "w-8 h-8 flex items-center justify-center rounded-[var(--r-sm)] transition-colors disabled:opacity-40",
        active ? "bg-[var(--cobalt-50)] text-[var(--cobalt-700)]" : "text-[var(--ink-700)] hover:bg-[var(--fill-100)]",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="w-px h-5 mx-1" style={{ background: "var(--line-200)" }} />;

function Toolbar({ editor, defaultCta }: { editor: Editor; defaultCta: CtaType }) {
  const c = () => editor.chain().focus();

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (e.g. /blog/some-article or https://…)", prev ?? "");
    if (url === null) return;
    if (url.trim() === "") { c().extendMarkRange("link").unsetLink().run(); return; }
    if (!/^(\/|https?:\/\/|mailto:)/i.test(url.trim())) { window.alert("Use a site path starting with / or a full https:// URL."); return; }
    c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function addImage() {
    const src = window.prompt("Image URL (https://…)");
    if (!src) return;
    if (!/^https:\/\//i.test(src.trim())) { window.alert("Image URLs must start with https://"); return; }
    const alt = window.prompt("Alt text (describe the image for screen readers)") ?? "";
    c().setImage({ src: src.trim(), alt: alt.trim() }).run();
  }

  const inTable = editor.isActive("table");

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex items-center flex-wrap gap-0.5 p-1 rounded-[var(--r-md)] border"
      style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
    >
      <Btn label="Paragraph" active={editor.isActive("paragraph")} onClick={() => c().setParagraph().run()}><Pilcrow size={15} /></Btn>
      <Btn label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></Btn>
      <Btn label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <Sep />
      <Btn label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}><Bold size={15} /></Btn>
      <Btn label="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}><Italic size={15} /></Btn>
      <Btn label="Link" active={editor.isActive("link")} onClick={setLink}><Link2 size={15} /></Btn>
      {editor.isActive("link") && <Btn label="Remove link" onClick={() => c().unsetLink().run()}><Link2Off size={15} /></Btn>}
      <Sep />
      <Btn label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}><List size={15} /></Btn>
      <Btn label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={15} /></Btn>
      <Btn label="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}><Quote size={15} /></Btn>
      <Btn label="Horizontal rule" onClick={() => c().setHorizontalRule().run()}><Minus size={15} /></Btn>
      <Sep />
      <Btn label="Image" onClick={addImage}><ImagePlus size={15} /></Btn>
      <Btn label="Insert table" disabled={inTable} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={15} /></Btn>
      {inTable && (
        <>
          <Btn label="Add row below" onClick={() => c().addRowAfter().run()}><Rows3 size={15} /></Btn>
          <Btn label="Add column after" onClick={() => c().addColumnAfter().run()}><Columns3 size={15} /></Btn>
          <Btn label="Delete row" onClick={() => c().deleteRow().run()}><span className="text-[11px] font-bold">−R</span></Btn>
          <Btn label="Delete column" onClick={() => c().deleteColumn().run()}><span className="text-[11px] font-bold">−C</span></Btn>
          <Btn label="Delete table" onClick={() => c().deleteTable().run()}><Trash2 size={15} /></Btn>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" aria-label="Insert CTA block" title="Insert CTA block"
              className="h-8 px-2 flex items-center gap-1 rounded-[var(--r-sm)] text-[12.5px] font-semibold text-[var(--ink-700)] hover:bg-[var(--fill-100)]" />
          }
        >
          <Megaphone size={15} /> CTA
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {[defaultCta, ...CTA_TYPES.filter((t) => t !== defaultCta)].map((t) => (
            <DropdownMenuItem key={t} onClick={() => c().insertContent({ type: "ctaBlock", attrs: { ctaType: t } }).run()}>
              {CTA_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Sep />
      <Btn label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 size={15} /></Btn>
      <Btn label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 size={15} /></Btn>
    </div>
  );
}
