// A contact sheet: the shots of one group laid out as a grid, columns by one
// facet (the screen, by default) and rows by the rest, each cell labelled.
// Composed in the browser itself — an HTML page of the PNGs, screenshotted —
// so the skill needs no image library. More columns than `wrap` continue
// in a band below, each band with its own header row.

/* global document */

import { readFileSync } from "node:fs";

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #1c1f24; color: #e6e8eb; font: 13px/1.4 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .sheet { padding: 20px; display: inline-block; min-width: 100%; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
  .meta { color: #9aa0a6; margin: 0 0 16px; font-size: 12px; }
  table { border-collapse: separate; border-spacing: 12px 16px; }
  th { text-align: left; font-weight: 600; color: #c9ccd1; padding: 0 4px; white-space: nowrap; vertical-align: bottom; }
  th.row { vertical-align: top; padding-top: 4px; max-width: 160px; white-space: normal; }
  td { vertical-align: top; padding: 0; }
  .cell { background: #2a2e34; border-radius: 6px; padding: 6px; }
  .cell img { display: block; width: var(--w); height: auto; border-radius: 3px; background: #000; }
  .cell .cap { margin-top: 6px; color: #9aa0a6; font-size: 11px; white-space: nowrap; }
  .cell.error { width: var(--w); min-height: 120px; color: #ff8a80; white-space: pre-wrap; font-size: 11px; }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

/**
 * @param {import("playwright-core").Browser} browser
 * @param {{ title: string, meta: string, cols: {id: string, label: string}[], rows: {id: string, label: string}[],
 *           cell: (row: string, col: string) => ({ path?: string, error?: string, caption?: string } | undefined),
 *           cellWidth: number, wrap?: number, out: string }} sheet
 */
export async function composeSheet(browser, sheet) {
  const wrap = Math.max(1, sheet.wrap ?? 6);
  const bands = [];
  for (let i = 0; i < sheet.cols.length; i += wrap) {
    const cols = sheet.cols.slice(i, i + wrap);
    const rows = sheet.rows.map((row) => {
      const tds = cols.map((col) => {
        const shot = sheet.cell(row.id, col.id);
        if (!shot) return `<td></td>`;
        if (shot.error)
          return `<td><div class="cell error">${esc(shot.error)}</div></td>`;
        const data = readFileSync(shot.path).toString("base64");
        return `<td><div class="cell"><img src="data:image/png;base64,${data}" alt=""><div class="cap">${esc(shot.caption ?? "")}</div></div></td>`;
      });
      return `<tr><th class="row">${esc(row.label)}</th>${tds.join("")}</tr>`;
    });
    bands.push(
      `<table><tr><th></th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>${rows.join("\n")}</table>`,
    );
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="sheet" style="--w:${sheet.cellWidth}px">
    <h1>${esc(sheet.title)}</h1>
    <p class="meta">${esc(sheet.meta)}</p>
    ${bands.join("\n")}
  </div></body></html>`;
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
  );
  await page.locator(".sheet").screenshot({ path: sheet.out, type: "png" });
  await context.close();
  return sheet.out;
}
