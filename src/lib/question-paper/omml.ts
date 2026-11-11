// Office Math (OMML, the equations in .docx files) → LaTeX.
//
// mammoth ignores equations entirely, which would silently drop the maths
// from a question. This converter covers the structures that appear in
// school and Olympiad papers: fractions, powers, subscripts, roots,
// brackets, n-ary operators (Σ, ∫), functions, accents, matrices and
// equation arrays. Anything unknown falls through to its text content, so
// nothing is ever dropped silently.

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

type XmlElement = {
  nodeType: number;
  namespaceURI: string | null;
  localName: string | null;
  childNodes: ArrayLike<XmlNode>;
  getAttributeNS(ns: string, name: string): string | null;
  getAttribute(name: string): string | null;
  parentNode: XmlElement | null;
  ownerDocument: XmlDocument;
};
type XmlNode = XmlElement & { nodeValue: string | null; textContent: string | null };
type XmlDocument = {
  documentElement: XmlElement;
  createElementNS(ns: string, qname: string): XmlElement & { appendChild(n: unknown): void; setAttribute(n: string, v: string): void };
  createTextNode(text: string): unknown;
  getElementsByTagNameNS(ns: string, local: string): ArrayLike<XmlElement>;
};

const FUNCTIONS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "exp", "lim", "max", "min", "det", "gcd", "lcm"]);

const NARY: Record<string, string> = {
  "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∭": "\\iiint", "∮": "\\oint", "⋃": "\\bigcup", "⋂": "\\bigcap",
};

const ACCENTS: Record<string, string> = {
  "̂": "\\hat", "̃": "\\tilde", "̄": "\\bar", "̅": "\\overline", "̇": "\\dot", "̈": "\\ddot", "⃗": "\\vec", "→": "\\vec",
};

const SYMBOLS: Record<string, string> = {
  "×": "\\times ", "÷": "\\div ", "±": "\\pm ", "∓": "\\mp ", "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ", "≈": "\\approx ",
  "∞": "\\infty ", "π": "\\pi ", "θ": "\\theta ", "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ",
  "Δ": "\\Delta ", "λ": "\\lambda ", "μ": "\\mu ", "σ": "\\sigma ", "φ": "\\phi ", "ω": "\\omega ", "Ω": "\\Omega ",
  "°": "^{\\circ}", "∠": "\\angle ", "△": "\\triangle ", "⊥": "\\perp ", "∥": "\\parallel ", "∈": "\\in ", "∉": "\\notin ",
  "⊂": "\\subset ", "⊆": "\\subseteq ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ", "→": "\\rightarrow ",
  "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "∴": "\\therefore ", "∵": "\\because ", "·": "\\cdot ", "√": "\\surd ",
  "∝": "\\propto ", "≡": "\\equiv ", "∼": "\\sim ", "≅": "\\cong ", "−": "-",
};

function escapeText(s: string): string {
  let out = "";
  for (const ch of s) {
    if (SYMBOLS[ch]) out += SYMBOLS[ch];
    else if ("#$%&_{}".includes(ch)) out += "\\" + ch;
    else if (ch === "\\") out += "\\backslash ";
    else if (ch === "^") out += "\\hat{}";
    else if (ch === "~") out += "\\sim ";
    else out += ch;
  }
  return out;
}

function children(el: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1) out.push(n);
  }
  return out;
}

function child(el: XmlElement, local: string): XmlElement | undefined {
  return children(el).find((c) => c.namespaceURI === M_NS && c.localName === local);
}

function prop(el: XmlElement, prName: string, local: string): string | undefined {
  const pr = child(el, prName);
  const p = pr && child(pr, local);
  if (!p) return undefined;
  return p.getAttributeNS(M_NS, "val") ?? p.getAttribute("m:val") ?? undefined;
}

const group = (s: string) => `{${s}}`;

function conv(el: XmlElement | undefined): string {
  if (!el) return "";
  if (el.namespaceURI !== M_NS) return convChildren(el);
  switch (el.localName) {
    case "oMath":
    case "e":
    case "num":
    case "den":
    case "sub":
    case "sup":
    case "deg":
    case "fName":
    case "lim":
      return convChildren(el);
    case "r": {
      const t = children(el).filter((c) => c.localName === "t").map((c) => (c as XmlNode).textContent ?? "").join("");
      if (FUNCTIONS.has(t.trim())) return `\\${t.trim()} `;
      return escapeText(t);
    }
    case "f": {
      const type = prop(el, "fPr", "type");
      const num = conv(child(el, "num"));
      const den = conv(child(el, "den"));
      if (type === "lin") return `${group(num)}/${group(den)}`;
      if (type === "noBar") return `\\genfrac{}{}{0pt}{}${group(num)}${group(den)}`;
      return `\\frac${group(num)}${group(den)}`;
    }
    case "sSup":
      return `${group(conv(child(el, "e")))}^${group(conv(child(el, "sup")))}`;
    case "sSub":
      return `${group(conv(child(el, "e")))}_${group(conv(child(el, "sub")))}`;
    case "sSubSup":
      return `${group(conv(child(el, "e")))}_${group(conv(child(el, "sub")))}^${group(conv(child(el, "sup")))}`;
    case "sPre":
      return `{}_${group(conv(child(el, "sub")))}^${group(conv(child(el, "sup")))}${group(conv(child(el, "e")))}`;
    case "rad": {
      const deg = conv(child(el, "deg")).trim();
      const e = conv(child(el, "e"));
      return deg ? `\\sqrt[${deg}]${group(e)}` : `\\sqrt${group(e)}`;
    }
    case "d": {
      const beg = prop(el, "dPr", "begChr") ?? "(";
      const end = prop(el, "dPr", "endChr") ?? ")";
      const sep = prop(el, "dPr", "sepChr") ?? "|";
      const parts = children(el).filter((c) => c.localName === "e").map(conv);
      const delim = (c: string, side: "left" | "right") => {
        if (c === "") return `\\${side}.`;
        if (c === "{" || c === "}") return `\\${side}\\${c}`;
        if (c === "|") return `\\${side}|`;
        if (c === "‖") return `\\${side}\\|`;
        if (c === "⌊") return `\\${side}\\lfloor`;
        if (c === "⌋") return `\\${side}\\rfloor`;
        if (c === "⌈") return `\\${side}\\lceil`;
        if (c === "⌉") return `\\${side}\\rceil`;
        if (c === "⟨") return `\\${side}\\langle`;
        if (c === "⟩") return `\\${side}\\rangle`;
        return `\\${side}${c}`;
      };
      return `${delim(beg, "left")} ${parts.join(` ${escapeText(sep)} `)} ${delim(end, "right")}`;
    }
    case "nary": {
      const chr = prop(el, "naryPr", "chr") ?? "∫";
      const op = NARY[chr] ?? escapeText(chr);
      const sub = conv(child(el, "sub"));
      const sup = conv(child(el, "sup"));
      return `${op}${sub ? `_${group(sub)}` : ""}${sup ? `^${group(sup)}` : ""} ${conv(child(el, "e"))}`;
    }
    case "func":
      return `${conv(child(el, "fName"))}${group(conv(child(el, "e")))}`;
    case "limLow":
      return `${conv(child(el, "e"))}_${group(conv(child(el, "lim")))}`;
    case "limUpp":
      return `\\overset${group(conv(child(el, "lim")))}${group(conv(child(el, "e")))}`;
    case "acc": {
      const chr = prop(el, "accPr", "chr") ?? "̂";
      return `${ACCENTS[chr] ?? "\\hat"}${group(conv(child(el, "e")))}`;
    }
    case "bar": {
      const pos = prop(el, "barPr", "pos") ?? "bot";
      return `${pos === "top" ? "\\overline" : "\\underline"}${group(conv(child(el, "e")))}`;
    }
    case "groupChr": {
      const chr = prop(el, "groupChrPr", "chr") ?? "⏟";
      const e = conv(child(el, "e"));
      return chr === "⏞" ? `\\overbrace${group(e)}` : chr === "⏟" ? `\\underbrace${group(e)}` : e;
    }
    case "eqArr":
      return `\\begin{array}{l} ${children(el).filter((c) => c.localName === "e").map(conv).join(" \\\\ ")} \\end{array}`;
    case "m": {
      const rows = children(el)
        .filter((c) => c.localName === "mr")
        .map((mr) => children(mr).filter((c) => c.localName === "e").map(conv).join(" & "));
      return `\\begin{matrix} ${rows.join(" \\\\ ")} \\end{matrix}`;
    }
    case "box":
    case "borderBox":
    case "phant":
      return conv(child(el, "e"));
    default:
      // Property elements carry formatting only.
      if (el.localName?.endsWith("Pr")) return "";
      return convChildren(el);
  }
}

function convChildren(el: XmlElement): string {
  return children(el)
    .filter((c) => !(c.localName?.endsWith("Pr")))
    .map(conv)
    .join("");
}

/** LaTeX for one <m:oMath> or <m:oMathPara> element. */
export function ommlElementToLatex(el: XmlElement): string {
  if (el.localName === "oMathPara") {
    return children(el).filter((c) => c.localName === "oMath").map(conv).join(" \\\\ ").replace(/\s+/g, " ").trim();
  }
  return conv(el).replace(/\s+/g, " ").trim();
}

/** Parses a standalone OMML snippet (tests and debugging). */
export function ommlToLatex(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as XmlDocument;
  return ommlElementToLatex(doc.documentElement);
}

/**
 * Replaces every equation in a word/document.xml string with a plain text
 * run holding a placeholder token, and returns the LaTeX for each token.
 * Tokens survive the HTML → Markdown conversion unescaped, and are swapped
 * for `$…$` / `$$…$$` afterwards.
 */
export function replaceEquationsWithTokens(documentXml: string): { xml: string; equations: Array<{ latex: string; display: boolean }> } {
  const doc = new DOMParser().parseFromString(documentXml, "text/xml") as unknown as XmlDocument;
  const equations: Array<{ latex: string; display: boolean }> = [];

  // Handle oMathPara first (they contain oMath), then any remaining oMath.
  for (const local of ["oMathPara", "oMath"]) {
    const list = Array.from(doc.getElementsByTagNameNS(M_NS, local));
    for (const el of list) {
      if (!el.parentNode) continue; // already replaced as part of a parent
      // Skip oMath nested inside an oMathPara that still exists (handled above).
      if (local === "oMath" && el.parentNode.localName === "oMathPara") continue;
      const latex = ommlElementToLatex(el);
      const display = local === "oMathPara";
      const idx = equations.push({ latex, display }) - 1;
      const run = doc.createElementNS(W_NS, "w:r");
      const t = doc.createElementNS(W_NS, "w:t");
      t.setAttribute("xml:space", "preserve");
      t.appendChild(doc.createTextNode(` ⟦EQ${idx}⟧ `));
      run.appendChild(t);
      (el.parentNode as unknown as { replaceChild(a: unknown, b: unknown): void }).replaceChild(run, el);
    }
  }
  return { xml: new XMLSerializer().serializeToString(doc as never), equations };
}
