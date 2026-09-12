// Parte 6/7.7: garante que as cópias quentes de normalizeKind/parseHfRepo em
// background.js e offscreen.js não divergiram de shared.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ext = path.join(here, "..");

function extractFunction(src, name) {
  // Captura "function name(...) { ... }" com chaves balanceadas.
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) return null;
  let i = src.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  return null;
}

const sharedSrc = readFileSync(path.join(ext, "shared.js"), "utf8").replace(/\r\n/g, "\n");
const backgroundSrc = readFileSync(path.join(ext, "background.js"), "utf8").replace(/\r\n/g, "\n");
const offscreenSrc = readFileSync(path.join(ext, "offscreen.js"), "utf8").replace(/\r\n/g, "\n");

for (const fnName of ["normalizeKind", "parseHfRepo"]) {
  test(`sync ${fnName}: background.js === shared.js`, () => {
    const a = extractFunction(sharedSrc, fnName);
    const b = extractFunction(backgroundSrc, fnName);
    assert.ok(a, `shared.js tem ${fnName}`);
    assert.ok(b, `background.js tem ${fnName}`);
    // Compara o corpo normalizado: sem \r, sem diferença de indentação.
    const norm = (s) =>
      s
        .slice(s.indexOf("{"))
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");
    assert.equal(
      norm(a),
      norm(b),
      `${fnName} divergiu entre shared.js e background.js`,
    );
  });

  test(`sync ${fnName}: offscreen.js === shared.js`, () => {
    const a = extractFunction(sharedSrc, fnName);
    const b = extractFunction(offscreenSrc, fnName);
    assert.ok(a, `shared.js tem ${fnName}`);
    assert.ok(b, `offscreen.js tem ${fnName}`);
    const norm = (s) =>
      s
        .slice(s.indexOf("{"))
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");
    assert.equal(
      norm(a),
      norm(b),
      `${fnName} divergiu entre shared.js e offscreen.js`,
    );
  });
}
