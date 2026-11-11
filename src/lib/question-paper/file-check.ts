// Server-side verification of an uploaded question paper. Never trusts the
// client's file name, extension or MIME type: it sniffs the actual bytes.

import "server-only";
import JSZip from "jszip";
import { MAX_FILE_BYTES, type FileExt } from "./constants";

export class FileRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileRejectedError";
  }
}

const WORD_MAIN = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const WORD_MACRO_MAIN = "application/vnd.ms-word.document.macroEnabled.main+xml";
const WORD_TEMPLATE_MAIN = "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml";

/**
 * Confirms `bytes` really is the format `declared`. Throws FileRejectedError
 * with a user-safe message otherwise. Macro-enabled Word files are rejected
 * outright; nothing in a document is ever executed.
 */
export async function verifyFileBytes(bytes: Uint8Array, declared: FileExt): Promise<void> {
  if (bytes.byteLength === 0) throw new FileRejectedError("The uploaded file is empty.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new FileRejectedError("The file is larger than 15 MB.");

  if (declared === "pdf") {
    // "%PDF-" may be preceded by a little junk; the spec allows it in the first 1 KB.
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
    if (!head.includes("%PDF-")) throw new FileRejectedError("This file is not a valid PDF.");
    return;
  }

  // DOCX = ZIP ("PK\x03\x04") containing a WordprocessingML main part.
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new FileRejectedError("This file is not a valid Word (.docx) document.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new FileRejectedError("This Word document is damaged and can't be opened.");
  }
  const types = await zip.file("[Content_Types].xml")?.async("string");
  if (!types) throw new FileRejectedError("This Word document is damaged and can't be opened.");
  if (types.includes(WORD_MACRO_MAIN) || zip.file(/vbaProject\.bin$/i).length > 0) {
    throw new FileRejectedError("Macro-enabled Word documents aren't accepted. Save it as a normal .docx and try again.");
  }
  if (!types.includes(WORD_MAIN) && !types.includes(WORD_TEMPLATE_MAIN)) {
    throw new FileRejectedError("This file is not a Word (.docx) document.");
  }
  if (!zip.file("word/document.xml")) {
    throw new FileRejectedError("This Word document is damaged and can't be opened.");
  }
}

/** Keeps a safe, short display name; the storage path never uses it. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "question-paper").slice(0, 200);
}
