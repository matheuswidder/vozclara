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

test("VCShared não expõe mais o legado Python", () => {
  assert.equal(VC.explainMotorError, undefined);
  assert.equal(VC.motorHeadline, undefined);
  assert.equal(VC.motorView, undefined);
  assert.equal(VC.MOTOR_SETUP_HINT, undefined);
});


test("normalizeKind trava migração Turbo/Small", () => {
  assert.equal(VC.normalizeKind("v3"), "turbo");
  assert.equal(VC.normalizeKind("large-v3"), "turbo");
  assert.equal(VC.normalizeKind("Nemotron"), "turbo");
  assert.equal(VC.normalizeKind("custom"), "turbo");
  assert.equal(VC.normalizeKind("tiny"), "turbo");
  assert.equal(VC.normalizeKind("small"), "light");
  assert.equal(VC.normalizeKind("Small"), "light");
  assert.equal(VC.normalizeKind("light"), "light");
  assert.equal(VC.normalizeKind("turbo"), "turbo");
});

test("normalizeKind mapeia apelidos", () => {
  assert.equal(VC.normalizeKind("small"), "light");
  assert.equal(VC.normalizeKind("light"), "light");
  assert.equal(VC.normalizeKind("turbo"), "turbo");
  assert.equal(VC.normalizeKind("tiny"), "turbo");
  assert.equal(VC.normalizeKind("large-v3"), "turbo");
  assert.equal(VC.normalizeKind("nemotron"), "turbo");
  assert.equal(VC.normalizeKind("custom"), "turbo");
  assert.equal(VC.normalizeKind(""), "turbo");
  assert.equal(VC.normalizeKind(undefined), "turbo");
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

test("stateKind cobre error/ready/downloading", () => {
  assert.equal(VC.stateKind({ error: "boom" }), "warn");
  assert.equal(VC.stateKind({ ready: true }), "ok");
  assert.equal(VC.stateKind({ downloading: true }), "warn");
  assert.equal(VC.stateKind({}), "");
});

test("modelMeta e troca rápida", () => {
  assert.equal(VC.modelMeta("tiny").name, "Turbo");
  assert.equal(VC.modelMeta("turbo").size, "~560 MB");
  const sw = VC.primaryAction(
    { ready: true, kind: "turbo", cachedKinds: ["turbo", "light"] },
    "light",
  );
  assert.equal(sw.id, "switch");
  assert.match(sw.label, /Small/);
});

test("downloadLabel cobre turbo e small", () => {
  assert.equal(VC.downloadLabel("light"), "Baixando Small (~120 MB)…");
  assert.equal(VC.downloadLabel("turbo"), "Baixando Turbo (~560 MB)…");
  assert.equal(VC.downloadLabel("tiny"), "Baixando Turbo (~560 MB)…");
});

test("primaryAction: um botão, ação óbvia", () => {
  assert.equal(typeof VC.primaryAction, "function");
  assert.equal(VC.primaryAction({ downloading: true }, "turbo").id, "wait");
  assert.equal(VC.primaryAction({ ready: true, kind: "turbo" }, "turbo").id, "ready");
  assert.equal(VC.primaryAction({ ready: true, kind: "turbo" }, "light").id, "download");
  assert.match(VC.primaryAction({}, "light").label, /120 MB/);
});

test("kinds antigos viram turbo", () => {
  const loading = VC.primaryAction({ downloading: true }, "nemotron");
  assert.equal(loading.id, "wait");
  assert.deepEqual(VC.primaryAction({}, "nemotron"), VC.primaryAction({}, "turbo"));
  assert.deepEqual(VC.verifyRequest("Nemotron"), {
    type: "VOZCLARA_MODEL_VERIFY",
    kind: "turbo",
  });
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

test("fallbackLocalState ignora chaves desconhecidas", () => {
  const state = VC.fallbackLocalState({
    motorAlive: true,
    motorUp: true,
    motorInstalled: true,
    localModelReady: true,
    localProgress: { downloading: false, percent: 100, label: "stale" },
  });
  assert.equal(state.ready, true);
  assert.equal(state.motorAlive, undefined);
  assert.equal(state.motorUp, undefined);
  assert.equal(state.motorInstalled, undefined);
  assert.equal(state.downloading, false);
  assert.equal(state.gemma, undefined);
});

test("fallbackLocalState cobre progresso", () => {
  const state = VC.fallbackLocalState({
    localProgress: { downloading: true, percent: 8, label: "Baixando…" },
  });
  assert.equal(state.downloading, true);
  assert.equal(state.percent, 8);
  assert.equal(state.ready, false);
});

test("filterTranscriptByLang tira alfabeto estranho no português", () => {
  const mixed = "ऐसा पैसा क É a residência porque é de a namorada de Lipp também vai fazer.";
  const out = VC.filterTranscriptByLang(mixed, "pt");
  assert.match(out, /residência/);
  assert.equal(/[\u0900-\u097F]/.test(out), false);
  const cjk = "你好 これは teste em português";
  const clean = VC.filterTranscriptByLang(cjk, "pt");
  assert.equal(clean, "teste em português");
  assert.equal(VC.filterTranscriptByLang("oi tudo bem", "pt"), "oi tudo bem");
  assert.equal(VC.isLangCleaned(mixed, out), true);
});

test("shouldAttachVoiceCard ignora GIF, figurinha e foto", () => {
  assert.equal(VC.shouldAttachVoiceCard({ gif: true, audioIcon: false }), false);
  assert.equal(VC.shouldAttachVoiceCard({ sticker: true }), false);
  assert.equal(VC.shouldAttachVoiceCard({ bigPicture: true }), false);
  assert.equal(
    VC.shouldAttachVoiceCard({ bigPicture: true, slimWaveform: true }),
    false,
  );
  assert.equal(VC.shouldAttachVoiceCard({ video: true, audioIcon: true }), false);
  assert.equal(VC.shouldAttachVoiceCard({ quotedOnly: true, audioIcon: true }), false);
  assert.equal(VC.shouldAttachVoiceCard({ audioIcon: true }), true);
  assert.equal(VC.shouldAttachVoiceCard({ slimWaveform: true }), true);
});

test("modelHint fala do Whisper neste Chrome", () => {
  assert.match(VC.modelHint("light"), /Small/);
  assert.match(VC.modelHint("turbo"), /Chrome/);
  assert.match(VC.modelHint("nemotron"), /Turbo/);
});
