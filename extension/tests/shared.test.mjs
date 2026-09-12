// Parte 7.7: testes do shared.js (VCShared) em Node puro.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "..", "shared.js"), "utf8");

// Avalia o IIFE num contexto com globalThis limpo.
const sandbox = { globalThis: {} };
new Function("globalThis", src)(sandbox.globalThis);
const VC = sandbox.globalThis.VCShared;

test("VCShared é exposto como objeto", () => {
  assert.ok(VC && typeof VC === "object");
  assert.equal(typeof VC.normalizeKind, "function");
  assert.equal(typeof VC.parseHfRepo, "function");
});

test("normalizeKind mapeia apelidos", () => {
  assert.equal(VC.normalizeKind("large-v3"), "v3");
  assert.equal(VC.normalizeKind("PRECISE"), "v3");
  assert.equal(VC.normalizeKind("small"), "light");
  assert.equal(VC.normalizeKind("nemotron"), "nemotron");
  assert.equal(VC.normalizeKind("custom"), "custom");
  assert.equal(VC.normalizeKind(""), "turbo");
  assert.equal(VC.normalizeKind(undefined), "turbo");
  assert.equal(VC.normalizeKind("qualquer-coisa"), "turbo");
});

test("parseHfRepo aceita link, hf:// e org/name", () => {
  assert.equal(
    VC.parseHfRepo("https://huggingface.co/onnx-community/whisper-tiny"),
    "onnx-community/whisper-tiny",
  );
  assert.equal(VC.parseHfRepo("hf://Xenova/whisper-small"), "Xenova/whisper-small");
  assert.equal(VC.parseHfRepo("onnx-community/whisper-tiny"), "onnx-community/whisper-tiny");
  assert.equal(
    VC.parseHfRepo("https://huggingface.co/org/name/tree/main"),
    "org/name",
  );
  assert.equal(VC.parseHfRepo("só-um-nome"), "");
  assert.equal(VC.parseHfRepo(""), "");
  assert.equal(VC.parseHfRepo(null), "");
});

test("stateLabel cobre ready/downloading/error/label", () => {
  assert.equal(VC.stateLabel({ ready: true, model: "large-v3-turbo" }), "Pronto · large-v3-turbo");
  assert.equal(VC.stateLabel({ downloading: true }), "Baixando… deixe a aba aberta.");
  assert.equal(VC.stateLabel({ error: "boom" }), "boom");
  assert.equal(VC.stateLabel({ label: "custom" }), "custom");
  assert.equal(VC.stateLabel({}), "Escolha o modelo e clique em Baixar e usar.");
});

test("downloadLabel cobre todos os kinds", () => {
  assert.equal(VC.downloadLabel("nemotron"), "Baixando o instalador do Windows…");
  assert.equal(
    VC.downloadLabel("custom", "onnx-community/whisper-tiny"),
    "Baixando onnx-community/whisper-tiny…",
  );
  assert.equal(VC.downloadLabel("tiny"), "Baixando o tiny (~40 MB)…");
  assert.equal(VC.downloadLabel("light"), "Baixando o small (~120 MB)…");
  assert.equal(VC.downloadLabel("v3"), "Baixando o v3 (~1,5 GB)…");
  assert.equal(VC.downloadLabel("turbo"), "Baixando o turbo (~560 MB)…");
});

test("primaryAction: um botão, ação óbvia", () => {
  assert.equal(typeof VC.primaryAction, "function");
  assert.equal(VC.primaryAction({ downloading: true }, "turbo").id, "wait");
  assert.equal(VC.primaryAction({ ready: true, kind: "turbo" }, "turbo").id, "ready");
  assert.equal(VC.primaryAction({ ready: true, kind: "turbo" }, "tiny").id, "download");
  assert.equal(VC.primaryAction({ motorUp: true }, "nemotron").id, "ready");
  assert.equal(VC.primaryAction({ motorInstalled: true }, "nemotron").id, "wake");
  assert.equal(VC.primaryAction({}, "nemotron").id, "install");
  assert.match(VC.primaryAction({}, "tiny").label, /40 MB/);
});
