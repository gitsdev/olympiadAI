// Answer sheet → A4 PDF via headless Chromium. On Vercel this uses
// @sparticuz/chromium (a Lambda-compatible build); locally it uses an
// installed Chrome/Edge (set CHROME_EXECUTABLE_PATH to override).

import "server-only";
import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { pdfHeaderFooter, renderSheetHtml } from "./export-html";
import type { SheetModel } from "./sheet";

const LOCAL_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function launch(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const executablePath = process.env.CHROME_EXECUTABLE_PATH || LOCAL_CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) throw new Error("No Chrome found for PDF export. Set CHROME_EXECUTABLE_PATH.");
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
}

export async function renderPdf(sheet: SheetModel): Promise<Uint8Array> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    // The sheet is static HTML; no script in it should ever run.
    await page.setJavaScriptEnabled(false);
    // Only the KaTeX stylesheet/fonts and Google Fonts may load.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      const allowed = url.startsWith("data:") || url.startsWith("about:") ||
        url.startsWith("https://cdn.jsdelivr.net/npm/katex@") ||
        url.startsWith("https://fonts.googleapis.com/") || url.startsWith("https://fonts.gstatic.com/");
      if (allowed) void req.continue();
      else void req.abort();
    });
    await page.setContent(renderSheetHtml(sheet), { waitUntil: "load", timeout: 45_000 });
    // Web fonts (KaTeX, brand) load after the stylesheets; wait for them.
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 20_000 }).catch(() => undefined);
    const { headerTemplate, footerTemplate } = pdfHeaderFooter(sheet.title);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: "22mm", bottom: "20mm", left: "16mm", right: "16mm" },
      preferCSSPageSize: true,
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
