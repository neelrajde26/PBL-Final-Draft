// Collect user-visible English strings from the app (JSX text + likely UI string literals).
import ts from "typescript";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components"];
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(p) && files.push(p); });
roots.forEach(walk);

const UI_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label"]);
const SKIP_ATTRS = new Set(["className", "href", "src", "id", "key", "type", "role", "d", "viewBox", "fill", "stroke", "style", "name", "value", "rel", "target", "method", "action", "htmlFor", "autoComplete"]);
const out = new Set();
const looksUi = (s) => /[A-Za-z]{2}/.test(s) && /[a-z]/.test(s) && (/\s/.test(s) || /^[A-Z][a-z]+$/.test(s)) && !/^(https?:|\/|#|\.|--|var\(|rgba?\(|[a-z-]+:)/.test(s) && !/[{};]|=>|\$\{/.test(s) && !/^[a-z][a-z-]*( [a-z][a-z0-9:-]*)+$/.test(s) && s.length < 400;

for (const f of files) {
  const src = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n) => {
    if (ts.isJsxText(n)) { const t = n.getText().replace(/\s+/g, " ").trim(); if (t && /[A-Za-z]/.test(t)) out.add(t); }
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent;
      const s = n.text.replace(/\s+/g, " ").trim();
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return;
      if (ts.isJsxAttribute(p)) { const a = p.name.getText(); if (SKIP_ATTRS.has(a) || a.startsWith("data-")) return; if (UI_ATTRS.has(a) && /[A-Za-z]/.test(s)) { out.add(s); return; } }
      if (ts.isCallExpression(p) && /^(t|fetch|apiGet|apiPost|getElementById|querySelector|require|setItem|getItem|addEventListener|removeEventListener|Error)$/.test(p.expression.getText().split(".").pop())) return;
      if (ts.isPropertyAssignment(p) && p.name && /^(className|href|src|id|key|color|c|tint|img|background|fill|stroke|d|unit|type|tone|kind|icon|domain|v|path)$/.test(p.name.getText())) return;
      if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return;
      if (ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText())) return;
      if (looksUi(s)) out.add(s);
    } else if (ts.isTemplateExpression(n)) {
      // keep literal heads/tails of templates such as `Latest month ${x}`
      [n.head, ...n.templateSpans.map((s) => s.literal)].forEach((part) => { const s = part.text.replace(/\s+/g, " ").trim(); if (looksUi(s) && s.length > 3) out.add(s); });
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
const list = [...out].sort();
writeFileSync(process.argv[2] ?? "ui-strings.json", JSON.stringify(list, null, 1));
console.log(list.length, "strings");
