// Parte 6: normalizeKind/parseHfRepo vêm de shared.js (VCShared) — carregado
// antes deste arquivo em popup.html e options.html. Cópias em background.js e
// offscreen.js ficam com "// SYNC: shared.js" e teste de sync (extension/tests).
const normalizeKind = (k) => globalThis.VCShared.normalizeKind(k);
const parseHfRepo = (r) => globalThis.VCShared.parseHfRepo(r);

const $ = (id) => document.getElementById(id);

let lastPreferred = "turbo";

function metaOf(kind) {
  return globalThis.VCShared.modelMeta(kind);
}

function flashEl(el) {
  if (!el) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

function syncModelHint() {
  const hint = $("model-hint");
  if (!hint) return;
  const kind = normalizeKind($("model")?.value);
  hint.textContent = globalThis.VCShared.modelHint(kind);
  hint.hidden = false;
}

function syncFields() {
  const custom = $("custom-fields");
  if (custom) custom.hidden = $("model")?.value !== "custom";
  syncModelHint();
}

function paint(extra) {
  const status = $("local-status") || $("status");
  if (!status) return;
  if (extra) {
    status.textContent = extra.text;
    status.dataset.kind = extra.kind;
    return;
  }
  status.textContent = "O áudio não sai deste computador.";
  status.dataset.kind = "ok";
}

function showQualityFallback() {
  const take = globalThis.VCShared?.takeQualityFallback;
  if (!take) return Promise.resolve();
  return take().then((entry) => {
    if (!entry?.label) return;
    const el = $("local-status") || $("status");
    if (!el) return;
    el.textContent = entry.label;
    el.dataset.kind = "warn";
    el.className = "status warn";
  });
}

function renderLocal(state) {
  const meter = $("meter");
  const bar = $("bar");
  const localStatus = $("local-status");
  const download = $("download");
  const reveal = $("reveal");
  const pathEl = $("local-path");
  if (!download) return;

  const ready = Boolean(state?.ready);
  const downloading = Boolean(state?.downloading);
  const percent = Number(state?.percent) || 0;
  const error = state?.error || "";
  const label = globalThis.VCShared.stateLabel(state);
  const selected = normalizeKind($("model")?.value);
  const action = globalThis.VCShared.primaryAction(state, selected);

  if (localStatus) {
    localStatus.textContent = error || label;
    localStatus.dataset.kind = error
      ? "warn"
      : action.id === "ready"
        ? "ok"
        : downloading
          ? "warn"
          : "";
  }

  if (pathEl) pathEl.hidden = true;

  if (meter && bar) {
    const showBar = downloading || (percent > 0 && percent < 100 && !ready);
    meter.hidden = !showBar;
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  download.disabled = action.disabled;
  download.dataset.action = action.id;
  download.textContent = action.label;

  if (reveal) {
    reveal.hidden = action.id !== "ready";
    reveal.disabled = downloading || action.id !== "ready";
  }

  if (action.id === "ready") {
    chrome.storage.local.set({ preferredKind: selected }).catch(() => {});
  }
}

async function queryLocal(opts) {
  const selected = normalizeKind($("model")?.value);
  try {
    const state = await chrome.runtime.sendMessage(
      globalThis.VCShared.verifyRequest(selected),
    );
    if (state && typeof state === "object" && state.checked) {
      renderLocal(state);
      void showQualityFallback();
      return;
    }
  } catch {
    /* cai no storage */
  }
  try {
    const stored = await chrome.storage.local.get(globalThis.VCShared.FALLBACK_KEYS);
    renderLocal(globalThis.VCShared.fallbackLocalState(stored));
    void showQualityFallback();
  } catch (err) {
    renderLocal({
      downloading: false,
      error: friendly(err),
    });
  }
}

async function load() {
  try {
    const stored = await chrome.storage.local.get([
      "language",
      "localModelKind",
      "preferredKind",
      "customModelInput",
      "customModelRepo",
      "autoTranscribe",
    ]);
    $("language").value = stored.language || "pt";
    if ($("auto-tx")) $("auto-tx").checked = Boolean(stored.autoTranscribe);
    if ($("model")) {
      lastPreferred = normalizeKind(
        stored.preferredKind || stored.localModelKind || "turbo",
      );
      $("model").value = lastPreferred;
    }
    if ($("hf-repo")) {
      $("hf-repo").value = stored.customModelInput || stored.customModelRepo || "";
    }
    syncFields();
    paint();
    void queryLocal();
  } catch (err) {
    paint({ text: friendly(err), kind: "warn" });
  }
}

async function save() {
  await chrome.storage.local.set({
    language: $("language").value,
    customModelInput: $("hf-repo")?.value.trim() || "",
    autoTranscribe: Boolean($("auto-tx")?.checked),
  });
  paint({ text: "Guardado.", kind: "ok" });
}

async function hideConfirm() {
  const box = $("confirm");
  if (box) box.hidden = true;
}

function showConfirm(kind) {
  const box = $("confirm");
  const text = $("confirm-text");
  const yes = $("confirm-yes");
  const meta = metaOf(kind);
  if (!box || !text) return;
  text.textContent = `Baixar ${meta.name}${meta.size ? ` · ${meta.size}` : ""}?`;
  if (yes) yes.textContent = `Baixar ${meta.name}`;
  box.hidden = false;
  flashEl(box);
}

async function onModelChange() {
  syncFields();
  hideConfirm();
  const kind = normalizeKind($("model")?.value);
  lastPreferred = kind;
  await chrome.storage.local.set({ preferredKind: kind });
  const localStatus = $("local-status");
  if (localStatus) {
    localStatus.textContent = `Verificando ${metaOf(kind).name}…`;
    localStatus.dataset.kind = "warn";
    flashEl(localStatus);
  }
  if (kind === "custom") {
    void queryLocal();
    return;
  }
  try {
    const probe = await chrome.runtime.sendMessage({
      type: "VOZCLARA_MODEL_PROBE",
      kind,
      repo: $("hf-repo")?.value.trim() || "",
    });
    if (probe?.cached) {
      lastPreferred = kind;
      void startDownload(kind, { switching: true });
      return;
    }
    showConfirm(kind);
    void queryLocal();
  } catch {
    showConfirm(kind);
  }
}

function revertModel() {
  if ($("model")) $("model").value = lastPreferred;
  hideConfirm();
  syncFields();
  void queryLocal();
}

async function commitModel() {
  const kind = normalizeKind($("model")?.value);
  const download = $("download");
  const action = download?.dataset.action || "download";
  if (action === "wait" || action === "ready") return;
  hideConfirm();
  void startDownload(kind, { switching: action === "switch" });
}

function friendly(err) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/message port closed/i.test(raw)) {
    return "O painel do ícone fechou. O download abre numa aba — veja a barra lá.";
  }
  return raw;
}

async function revealFolder() {
  const reveal = $("reveal");
  if (reveal) reveal.disabled = true;
  renderLocal({
    ready: true,
    downloading: true,
    percent: 1,
    label: "Abrindo o Explorer…",
  });
  try {
    const result = await chrome.runtime.sendMessage({
      type: "VOZCLARA_MODEL_REVEAL",
    });
    if (!result?.ok) throw new Error(result?.error || "Não abri o Explorer.");
    paint({
      text: "Pasta Downloads/VozClara no Explorer.",
      kind: "ok",
    });
  } catch (err) {
    paint({ text: friendly(err), kind: "warn" });
  } finally {
    void queryLocal();
  }
}

async function startDownload(kind, opts = {}) {
  const want = normalizeKind(kind);
  const repo = want === "custom" ? ($("hf-repo")?.value.trim() || "") : "";
  const parsed = parseHfRepo(repo);
  const meta = metaOf(want);
  if (want === "custom" && /parakeet|fastconformer|canary|nemo[-_]?asr/i.test(parsed)) {
    paint({
      text: "Neste Chrome só Whisper ONNX. Tente onnx-community/whisper-large-v3-turbo.",
      kind: "warn",
    });
    return;
  }
  if (want === "custom" && !parsed) {
    paint({
      text: "Cole um link do Hugging Face, tipo onnx-community/whisper-large-v3-turbo.",
      kind: "warn",
    });
    return;
  }
  hideConfirm();
  lastPreferred = want;
  renderLocal({
    downloading: !opts.switching,
    ready: Boolean(opts.switching),
    percent: opts.switching ? 70 : 1,
    kind: want,
    label: opts.switching
      ? `Trocando para ${meta.name}…`
      : globalThis.VCShared.downloadLabel(want, repo),
  });
  await chrome.storage.local.set({
    customModelInput: repo,
    preferredKind: want,
  });
  syncFields();
  try {
    const result = await chrome.runtime.sendMessage({
      type: "VOZCLARA_MODEL_DOWNLOAD",
      kind: want,
      repo: parseHfRepo(repo),
    });
    if (!result?.ok) {
      throw new Error(result?.error || "Não deu para iniciar o download.");
    }
    paint({
      text: opts.switching
        ? `${meta.name} já estava aqui. Aplicando…`
        : "Deixe a aba aberta até Pronto. Pode fechar este painel.",
      kind: "ok",
    });
  } catch (err) {
    renderLocal({
      downloading: false,
      ready: false,
      percent: 0,
      error: friendly(err),
    });
  } finally {
    void queryLocal();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void load();
  $("language").addEventListener("change", () => void save());
  $("auto-tx")?.addEventListener("change", () => void save());
  $("model")?.addEventListener("change", () => void onModelChange());
  $("hf-repo")?.addEventListener("change", () => void save());
  $("confirm-yes")?.addEventListener("click", () => {
    hideConfirm();
    void startDownload(normalizeKind($("model")?.value));
  });
  $("confirm-no")?.addEventListener("click", () => revertModel());
  const download = $("download");
  if (download) {
    download.addEventListener("click", () => void commitModel());
  }
  const reveal = $("reveal");
  if (reveal) reveal.addEventListener("click", () => void revealFolder());
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    changes.localProgress ||
    changes.localModelReady ||
    changes.localModelId ||
    changes.cachedKinds
  ) {
    void queryLocal();
  }
});
