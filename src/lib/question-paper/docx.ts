// .docx → sanitised Markdown + extracted images, for Claude to read.
//
// mammoth only parses the document XML; it never runs macros or embedded
// objects (and macro-enabled files are rejected before we get here).
// Equations are converted to LaTeX first (mammoth would drop them), and
// images are pulled out so diagram questions can be sent to vision.

import "server-only";
import JSZip from "jszip";
import mammoth from "mammoth";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { replaceEquationsWithTokens } from "./omml";
import { FileRejectedError } from "./file-check";

/** Image types Claude's vision input accepts. */
const VISION_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const MAX_IMAGES = 60;
/** Roughly 40 printed pages of dense text. */
const MAX_MARKDOWN_CHARS = 200_000;

export interface DocxImage {
  id: string;          // "img3"
  mime: string;
  bytes: Uint8Array;
  supported: boolean;  // false: unreadable format (EMF/WMF/OLE) or too large
  altText?: string;
}

export interface DocxContent {
  markdown: string;
  images: DocxImage[];
  equationCount: number;
  /** OLE objects (e.g. legacy Equation Editor 3.0) that can't be read. */
  oleObjectCount: number;
}

export async function convertDocx(bytes: Uint8Array): Promise<DocxContent> {
  const zip = await JSZip.loadAsync(bytes);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new FileRejectedError("This Word document is damaged and can't be opened.");

  const oleObjectCount = (docXml.match(/<w:object\b/g) ?? []).length;
  const { xml, equations } = replaceEquationsWithTokens(docXml);
  zip.file("word/document.xml", xml);
  const patched = await zip.generateAsync({ type: "nodebuffer" });

  const images: DocxImage[] = [];
  let html: string;
  try {
    const result = await mammoth.convertToHtml(
      { buffer: patched },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const id = `img${images.length + 1}`;
          const buf = new Uint8Array(await image.readAsBuffer());
          const mime = (image.contentType || "").toLowerCase();
          const supported = VISION_MIME.has(mime) && buf.byteLength <= MAX_IMAGE_BYTES && images.length < MAX_IMAGES;
          // mammoth exposes altText at runtime but not in its type definitions.
          const altText = (image as { altText?: string }).altText;
          images.push({ id, mime, bytes: buf, supported, altText });
          return { src: `qps-image:${id}`, ...(altText ? { alt: altText } : {}) } as { src: string };
        }),
      },
    );
    html = result.value;
  } catch {
    throw new FileRejectedError("This Word document is damaged and can't be read.");
  }

  // Sanitise (allow our image scheme) and convert to Markdown.
  const schema = {
    ...defaultSchema,
    protocols: { ...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src ?? []), "qps-image"] },
  };
  let md = String(
    unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, schema)
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify, { bullet: "-", emphasis: "*", strong: "*", fences: true, listItemIndent: "one" })
      .processSync(html),
  );

  // Images → explicit markers the model can refer back to.
  md = md.replace(/!\[([^\]]*)\]\(qps-image:(img\d+)\)/g, (_m, alt: string, id: string) => {
    const img = images.find((i) => i.id === id);
    const note = img && !img.supported ? " (unreadable image format)" : "";
    return `⟦IMAGE ${id}${note}${alt ? `: ${alt}` : ""}⟧`;
  });
  // Equation tokens → LaTeX.
  md = md.replace(/⟦EQ(\d+)⟧/g, (_m, n: string) => {
    const eq = equations[Number(n)];
    if (!eq || !eq.latex) return "⟦UNREADABLE EQUATION⟧";
    return eq.display ? `\n\n$$${eq.latex}$$\n\n` : `$${eq.latex}$`;
  });
  if (oleObjectCount > 0) {
    md += `\n\n⟦NOTE: this document contains ${oleObjectCount} embedded object(s) (e.g. old-style equations) that could not be read.⟧\n`;
  }

  md = md.replace(/\n{3,}/g, "\n\n").trim();
  if (!md.replace(/⟦[^⟧]*⟧/g, "").trim() && images.length === 0) {
    throw new FileRejectedError("This Word document has no readable content.");
  }
  if (md.length > MAX_MARKDOWN_CHARS) {
    throw new FileRejectedError("This document is too long. The limit is about 40 pages; split it and upload each part.");
  }
  return { markdown: md, images, equationCount: equations.length, oleObjectCount };
}
