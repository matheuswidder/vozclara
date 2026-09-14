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
  assert.equal(VC.downloadLabel("nemotron"), "Verificando o motor no PC…");
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
  assert.equal(VC.primaryAction({ downloading: true }, "nemotron").id, "wait");
  assert.equal(VC.primaryAction({ downloading: true }, "nemotron").label, "Verificando…");
  assert.equal(VC.primaryAction({}, "nemotron").id, "install");
  assert.equal(VC.primaryAction({}, "nemotron").label, "Verificar o motor");
  assert.match(VC.MOTOR_SETUP_HINT, /Ligar o motor/);
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
  const off = VC.gemmaAction({ motorAlive: false }, "qwen");
  assert.equal(off.id, "wake");
  const stale = VC.gemmaAction(
    { motorAlive: true, gemmaStale: true, gemma: { stale: true } },
    "qwen",
  );
  assert.equal(stale.id, "update");
  assert.match(stale.label, /Setup/i);
  const waiting = VC.gemmaAction(
    { motorAlive: true, gemmaWaiting: true, gemmaStale: true },
    "qwen",
  );
  assert.equal(waiting.id, "update");
  assert.equal(waiting.disabled, false);
  const fail = VC.gemmaAction(
    {
      motorAlive: true,
      motorUp: true,
      gemma: { error: "401 Client Error gated repo for url huggingface" },
    },
    "qwen",
  );
  assert.equal(fail.id, "retry");
  assert.match(fail.status, /Hugging Face/i);
  const crash = VC.explainGemmaError(
    "O motor reiniciou no meio do download. Faltou RAM.",
  );
  assert.match(crash, /RAM/);
  const viewFail = VC.gemmaView({
    motorAlive: true,
    gemma: { error: "boom" },
  });
  assert.equal(viewFail.model.text, "Falhou");
  const view = VC.gemmaView({
    motorAlive: true,
    gemma: { loading: true, percent: 22 },
  });
  assert.equal(view.motor.text, "Ligado");
  assert.match(view.model.text, /22/);
  const wait = VC.gemmaAction(
    { motorAlive: true, gemma: { loading: true, percent: 40 } },
    "qwen",
  );
  assert.equal(wait.id, "wait");
  const ready = VC.gemmaAction(
    { motorAlive: true, motorUp: true, gemma: { ready: true, kind: "qwen", bytes: 1120000000 } },
    "qwen",
  );
  assert.equal(ready.id, "ready");
  assert.equal(ready.canDelete, true);
  assert.match(ready.status, /disco/i);
  const cached = VC.gemmaAction(
    { motorAlive: true, motorUp: true, gemma: { cached: true, bytes: 900000000 } },
    "qwen",
  );
  assert.equal(cached.id, "download");
  assert.equal(cached.label, "Carregar");
  assert.equal(cached.canDelete, true);
  const dl = VC.gemmaAction({ motorAlive: true, motorUp: true, gemma: {} }, "qwen");
  assert.equal(dl.id, "download");
  assert.equal(dl.canDelete, false);
  assert.match(dl.label, /Qwen/i);
  assert.match(VC.formatGemmaSize(1120000000), /GB/);
});

test("formatSuggestPrompt usa só o áudio transcrito", () => {
  const prompt = VC.formatSuggestPrompt([
    { outgoing: false, voice: false, text: "Vai no mercado?" },
    { outgoing: true, voice: false, text: "Tô saindo" },
    { outgoing: false, voice: true, text: "Leite e pão" },
  ]);
  assert.equal(prompt, "Leite e pão");
  assert.equal(VC.formatSuggestPrompt("  Recado só  "), "Recado só");
  assert.equal(VC.formatSuggestPrompt([]), "");
});

test("gemmaMeta aponta para Qwen 1.5B Q4", () => {
  assert.equal(VC.normalizeGemma("e2b"), "qwen");
  assert.equal(VC.normalizeGemma("it"), "qwen");
  assert.equal(VC.normalizeGemma("assistant"), "qwen");
  assert.match(VC.gemmaMeta("qwen").name, /Qwen/i);
  assert.match(VC.gemmaMeta().repo, /Qwen2\.5-1\.5B-Instruct-GGUF/);
});
