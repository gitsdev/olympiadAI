// A small LaTeX parser for the maths that appears in school answers, used to
// produce native Word equations in the DOCX export. It understands
// fractions, powers, subscripts, roots, \left…\right brackets, sums,
// integrals, \text{} and common symbols. Anything it doesn't know is kept
// as readable text rather than dropped.

export type MathNode =
  | { t: "text"; v: string }
  | { t: "frac"; num: MathNode[]; den: MathNode[] }
  | { t: "sup"; base: MathNode[]; sup: MathNode[] }
  | { t: "sub"; base: MathNode[]; sub: MathNode[] }
  | { t: "subsup"; base: MathNode[]; sub: MathNode[]; sup: MathNode[] }
  | { t: "sqrt"; body: MathNode[]; degree: MathNode[] | null }
  | { t: "brackets"; kind: "round" | "square" | "curly" | "angle" | "bar"; body: MathNode[] }
  | { t: "op"; op: "sum" | "int" | "prod"; sub: MathNode[] | null; sup: MathNode[] | null };

export const LATEX_SYMBOLS: Record<string, string> = {
  times: "×", div: "÷", pm: "±", mp: "∓", cdot: "·", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠",
  approx: "≈", equiv: "≡", sim: "∼", cong: "≅", propto: "∝", infty: "∞", to: "→", rightarrow: "→", leftarrow: "←",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", implies: "⇒", iff: "⇔", therefore: "∴", because: "∵",
  angle: "∠", triangle: "△", perp: "⊥", parallel: "∥", circ: "°", degree: "°", in: "∈", notin: "∉", subset: "⊂",
  subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", partial: "∂",
  nabla: "∇", ldots: "…", cdots: "⋯", dots: "…", prime: "′", percent: "%", lt: "<", gt: ">",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  sin: "sin", cos: "cos", tan: "tan", cot: "cot", sec: "sec", csc: "cosec", cosec: "cosec", log: "log", ln: "ln",
  exp: "exp", lim: "lim", max: "max", min: "min", gcd: "gcd", lcm: "lcm", det: "det",
  quad: "  ", qquad: "    ", ",": " ", ";": " ", ":": " ", "!": "", " ": " ",
  "{": "{", "}": "}", "%": "%", "$": "$", "&": "&", "#": "#", "_": "_", "|": "‖", backslash: "\\",
};

const TEXT_COMMANDS = new Set(["text", "textrm", "textbf", "textit", "mathrm", "mathbf", "mathit", "operatorname", "mbox", "mathsf", "mathtt"]);
const IGNORED_WRAPPERS = new Set(["displaystyle", "textstyle", "scriptstyle", "limits", "nolimits", "boxed", "underline", "overline", "bar", "vec", "hat", "tilde", "dot", "overrightarrow"]);

type BracketKind = Extract<MathNode, { t: "brackets" }>["kind"];
const OPEN: Record<string, BracketKind> = {
  "(": "round", "[": "square", "\\{": "curly", "\\langle": "angle", "|": "bar", "\\lvert": "bar", "\\|": "bar",
};

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parse(): MathNode[] {
    return this.seq(() => this.i >= this.s.length);
  }

  private peek(): string {
    return this.s[this.i] ?? "";
  }

  private readCommand(): string {
    // at "\"
    this.i++;
    const m = /^[a-zA-Z]+/.exec(this.s.slice(this.i));
    if (m) {
      this.i += m[0].length;
      return m[0];
    }
    return this.s[this.i++] ?? "";
  }

  private skipSpaces() {
    while (this.peek() === " ") this.i++;
  }

  /** One argument: {group} or a single token. */
  private arg(): MathNode[] {
    this.skipSpaces();
    if (this.peek() === "{") {
      this.i++;
      const body = this.seq(() => this.peek() === "}" || this.i >= this.s.length);
      this.i++; // }
      return body;
    }
    if (this.peek() === "\\") {
      const save = this.i;
      const name = this.readCommand();
      if (LATEX_SYMBOLS[name] !== undefined) return [{ t: "text", v: LATEX_SYMBOLS[name] }];
      this.i = save;
      return this.atom() ?? [];
    }
    const ch = this.s[this.i++];
    return ch ? [{ t: "text", v: ch }] : [];
  }

  private rawGroup(): string {
    this.skipSpaces();
    if (this.peek() !== "{") return "";
    let depth = 0;
    const start = this.i + 1;
    for (; this.i < this.s.length; this.i++) {
      if (this.s[this.i] === "{") depth++;
      else if (this.s[this.i] === "}" && --depth === 0) break;
    }
    const out = this.s.slice(start, this.i);
    this.i++;
    return out;
  }

  private delimiter(): string {
    this.skipSpaces();
    if (this.peek() === "\\") {
      const save = this.i;
      const name = this.readCommand();
      if (name === "{" || name === "}" || name === "|") return `\\${name}`;
      if (["langle", "rangle", "lvert", "rvert", "lfloor", "rfloor", "lceil", "rceil"].includes(name)) return `\\${name}`;
      this.i = save;
      return "";
    }
    return this.s[this.i++] ?? "";
  }

  /** Returns nodes for one atom, or null at a stop. */
  private atom(): MathNode[] | null {
    const c = this.peek();
    if (c === "{") {
      this.i++;
      const body = this.seq(() => this.peek() === "}" || this.i >= this.s.length);
      this.i++;
      return body;
    }
    if (c === "\\") {
      const name = this.readCommand();
      if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
        return [{ t: "frac", num: this.arg(), den: this.arg() }];
      }
      if (name === "sqrt") {
        let degree: MathNode[] | null = null;
        this.skipSpaces();
        if (this.peek() === "[") {
          this.i++;
          degree = this.seq(() => this.peek() === "]" || this.i >= this.s.length);
          this.i++;
        }
        return [{ t: "sqrt", body: this.arg(), degree }];
      }
      if (name === "left") {
        const open = this.delimiter();
        const body = this.seq(() => this.s.startsWith("\\right", this.i) || this.i >= this.s.length);
        if (this.s.startsWith("\\right", this.i)) {
          this.i += "\\right".length;
          this.delimiter();
        }
        // "\left." is an invisible delimiter.
        return open === "." ? body : [{ t: "brackets", kind: OPEN[open] ?? "round", body }];
      }
      if (name === "right") return [];
      if (TEXT_COMMANDS.has(name)) return [{ t: "text", v: this.rawGroup().replace(/\\([{}%$&#_ ])/g, "$1") }];
      if (name === "sum" || name === "int" || name === "prod" || name === "oint") {
        return [{ t: "op", op: name === "oint" ? "int" : (name as "sum" | "int" | "prod"), sub: null, sup: null }];
      }
      if (name === "begin" || name === "end") {
        this.rawGroup(); // environment name; content is parsed inline
        return [];
      }
      if (name === "\\") return [{ t: "text", v: "; " }];
      if (IGNORED_WRAPPERS.has(name)) return [];
      if (LATEX_SYMBOLS[name] !== undefined) return [{ t: "text", v: LATEX_SYMBOLS[name] }];
      return [{ t: "text", v: name }];
    }
    if (c === "&") {
      this.i++;
      return [{ t: "text", v: " " }];
    }
    if (c === "~") {
      this.i++;
      return [{ t: "text", v: " " }];
    }
    this.i++;
    return [{ t: "text", v: c }];
  }

  private seq(stop: () => boolean): MathNode[] {
    const out: MathNode[] = [];
    while (!stop()) {
      const c = this.peek();
      if (c === "^" || c === "_") {
        this.i++;
        const script = this.arg();
        let base: MathNode[] = [];
        const prev = out.pop();
        if (prev?.t === "op") {
          if (c === "_") prev.sub = script;
          else prev.sup = script;
          out.push(prev);
          continue;
        }
        if (prev?.t === "text" && prev.v.length > 1) {
          // "2x^2": only the last character is the base.
          out.push({ t: "text", v: prev.v.slice(0, -1) });
          base = [{ t: "text", v: prev.v.slice(-1) }];
        } else if (prev?.t === "sub" && c === "^") {
          out.push({ t: "subsup", base: prev.base, sub: prev.sub, sup: script });
          continue;
        } else if (prev?.t === "sup" && c === "_") {
          out.push({ t: "subsup", base: prev.base, sub: script, sup: prev.sup });
          continue;
        } else if (prev) {
          base = [prev];
        }
        out.push(c === "^" ? { t: "sup", base, sup: script } : { t: "sub", base, sub: script });
        continue;
      }
      const nodes = this.atom();
      if (!nodes) break;
      for (const n of nodes) {
        const last = out[out.length - 1];
        if (n.t === "text" && last?.t === "text") last.v += n.v;
        else out.push(n);
      }
    }
    return out;
  }
}

export function parseLatex(src: string): MathNode[] {
  try {
    return new Parser(src.replace(/\s+/g, " ").trim()).parse();
  } catch {
    return [{ t: "text", v: src }];
  }
}

/** Plain-text rendering of LaTeX (x² style), used where real equations aren't possible. */
export function latexToPlain(src: string): string {
  const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ", "°": "°" };
  const SUB: Record<string, string> = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋",
    a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", k: "ₖ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", s: "ₛ", t: "ₜ", x: "ₓ",
  };
  const map = (s: string, table: Record<string, string>, fallback: (x: string) => string) =>
    [...s].every((ch) => table[ch]) ? [...s].map((ch) => table[ch]).join("") : fallback(s);
  const render = (nodes: MathNode[]): string => nodes.map((n) => {
    switch (n.t) {
      case "text": return n.v;
      case "frac": return `(${render(n.num)})/(${render(n.den)})`.replace(/^\((\w+)\)\/\((\w+)\)$/, "$1/$2");
      case "sup": return render(n.base) + map(render(n.sup), SUP, (x) => `^(${x})`);
      case "sub": return render(n.base) + map(render(n.sub), SUB, (x) => `_(${x})`);
      case "subsup": return render(n.base) + map(render(n.sub), SUB, (x) => `_(${x})`) + map(render(n.sup), SUP, (x) => `^(${x})`);
      case "sqrt": return `${n.degree ? map(render(n.degree), SUP, (x) => `(${x})`) : ""}√(${render(n.body)})`;
      case "brackets": {
        const [o, c] = { round: ["(", ")"], square: ["[", "]"], curly: ["{", "}"], angle: ["⟨", "⟩"], bar: ["|", "|"] }[n.kind];
        return `${o}${render(n.body)}${c}`;
      }
      case "op": return `${{ sum: "Σ", int: "∫", prod: "∏" }[n.op]}${n.sub ? `_(${render(n.sub)})` : ""}${n.sup ? `^(${render(n.sup)})` : ""}`;
    }
  }).join("");
  return render(parseLatex(src));
}
