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
  assert.equal(VC.stateLabel({ downloading: true }), "Baixando…");
  assert.equal(VC.stateLabel({ error: "boom" }), "boom");
  assert.equal(VC.stateLabel({ label: "custom" }), "custom");
  assert.equal(VC.stateLabel({}), "");
});

test("modelMeta e troca rápida", () => {
  assert.equal(VC.modelMeta("tiny").name, "Tiny");
  assert.equal(VC.modelMeta("turbo").size, "~560 MB");
  const sw = VC.primaryAction(
    { ready: true, kind: "turbo", cachedKinds: ["turbo", "tiny"] },
    "tiny",
  );
  assert.equal(sw.id, "switch");
  assert.match(sw.label, /Tiny/);
});

test("downloadLabel cobre todos os kinds", () => {
  assert.equal(VC.downloadLabel("nemotron"), "Baixando o instalador do Windows…");
  assert.equal(
    VC.downloadLabel("custom", "onnx-community/whisper-tiny"),
    "Baixando onnx-community/whisper-tiny…",
  );
  assert.equal(VC.downloadLabel("tiny"), "Baixando Tiny (~40 MB)…");
  assert.equal(VC.downloadLabel("light"), "Baixando Small (~120 MB)…");
  assert.equal(VC.downloadLabel("v3"), "Baixando v3 (~1,5 GB)…");
  assert.equal(VC.downloadLabel("turbo"), "Baixando Turbo (~560 MB)…");
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

test("Nemotron não mistura motor com download", () => {
  const loading = VC.primaryAction(
    { downloading: true, motorAlive: true, motorUp: false, phase: "download", percent: 32 },
    "nemotron",
  );
  assert.equal(loading.id, "ready");
  assert.equal(loading.label, "Motor ligado");
  const view = VC.motorView({
    motorAlive: true,
    motorUp: false,
    phase: "download",
    percent: 32,
    detail: "Baixando model.safetensors · 32%",
  });
  assert.equal(view.motor.text, "Ligado");
  assert.match(view.model.text, /32%/);
  assert.equal(view.model.kind, "warn");
  const ready = VC.motorView({ motorAlive: true, motorUp: true });
  assert.equal(ready.model.text, "Pronto");
});

test("collapseRepeats corta loop do tiny", () => {
  const loop =
    "Eu não tinha me falar do que eu não fui lá, " +
    "mas não fui lá, ".repeat(40) +
    "mas não minha vida, mas eu vou";
  const out = VC.collapseRepeats(loop);
  assert.ok(out.length < loop.length / 3);
  assert.match(out, /não fui lá/);
  assert.equal((out.match(/não fui lá/gi) || []).length < 6, true);
  assert.equal(VC.isRepeatLoop(loop, out), true);
  assert.equal(VC.collapseRepeats("oi tudo bem"), "oi tudo bem");
});

test("gemmaAction pede motor e marca pronto", () => {
  const off = VC.gemmaAction({ motorAlive: false }, "it");
  assert.equal(off.id, "wake");
  const stale = VC.gemmaAction(
    { motorAlive: true, gemmaStale: true, gemma: { stale: true } },
    "it",
  );
  assert.equal(stale.id, "update");
  const wait = VC.gemmaAction(
    { motorAlive: true, gemma: { loading: true, percent: 40 } },
    "it",
  );
  assert.equal(wait.id, "wait");
  const ready = VC.gemmaAction(
    { motorAlive: true, motorUp: true, gemma: { ready: true, kind: "it" } },
    "it",
  );
  assert.equal(ready.id, "ready");
  const dl = VC.gemmaAction({ motorAlive: true, motorUp: true, gemma: {} }, "it");
  assert.equal(dl.id, "download");
});

test("gemmaMeta distingue base, it e assistant", () => {
  assert.equal(VC.normalizeGemma("e2b"), "e2b");
  assert.equal(VC.normalizeGemma("it"), "it");
  assert.equal(VC.normalizeGemma("assistant"), "assistant");
  assert.match(VC.gemmaMeta("e2b").tip, /não/i);
  assert.match(VC.gemmaMeta("it").tipTitle, /responde/i);
  assert.match(VC.gemmaMeta("assistant").tip, /sozinho/i);
});
