// Parte 6: normalizeKind/parseHfRepo vêm de shared.js (VCShared) — carregado
// antes deste arquivo em popup.html e options.html. Cópias em background.js e
// offscreen.js ficam com "// SYNC: shared.js" e teste de sync (extension/tests).
const normalizeKind = (k) => globalThis.VCShared.normalizeKind(k);
const parseHfRepo = (r) => globalThis.VCShared.parseHfRepo(r);

const $ = (id) => document.getElementById(id);

function isLocal() {
  return $("provider").value === "local";
}

function syncFields() {
  const local = isLocal();
  const cloud = $("cloud-fields");
  const localBox = $("local-fields");
  if (cloud) cloud.hidden = local;
  if (localBox) localBox.hidden = !local;
  const custom = $("custom-fields");
  if (custom) custom.hidden = $("model")?.value !== "custom";
}

function paint(extra) {
  const status = $("status");
  if (!status) return;
  if (extra) {
    status.textContent = extra.text;
    status.dataset.kind = extra.kind;
    return;
  }
  if (isLocal()) {
    status.textContent = "O áudio não sai deste computador.";
    status.dataset.kind = "ok";
    return;
  }
  const key = $("apiKey").value.trim();
  if (!key) {
    status.textContent = "Sem chave ainda — a transcrição na nuvem não sai.";
    status.dataset.kind = "warn";
    return;
  }
  status.textContent = "Chave guardada neste navegador.";
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

  if (pathEl) {
    if (ready && action.id === "ready" && !error) {
      pathEl.hidden = false;
      pathEl.textContent = state.folder
        ? `Pasta: Downloads/VozClara/${state.model || "Whisper"}`
        : "Fica neste navegador. Pasta copia para Downloads/VozClara.";
    } else {
      pathEl.hidden = true;
    }
  }

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

async function queryLocal() {
  try {
    const state = await chrome.runtime.sendMessage({
      type: "VOZCLARA_MODEL_VERIFY",
    });
    if (state && typeof state === "object") {
      renderLocal(state);
      void showQualityFallback();
      return;
    }
  } catch {
    /* cai no storage */
  }
  try {
    const stored = await chrome.storage.local.get([
      "localModelReady",
      "localModelId",
      "localModelKind",
      "localModelDevice",
      "localProgress",
    ]);
    renderLocal({
      ready: Boolean(stored.localModelReady),
      downloading: Boolean(stored.localProgress?.downloading),
      percent: stored.localProgress?.percent || (stored.localModelReady ? 100 : 0),
      label: stored.localProgress?.label,
      error: stored.localProgress?.error,
      model: stored.localModelId,
      kind: stored.localModelKind,
      device: stored.localModelDevice,
    });
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
      "provider",
      "apiKey",
      "language",
      "localModelKind",
      "preferredKind",
      "customModelInput",
      "customModelRepo",
    ]);
    $("provider").value = stored.provider || "local";
    $("apiKey").value = stored.apiKey || "";
    $("language").value = stored.language || "pt";
    if ($("model")) {
      $("model").value = normalizeKind(
        stored.preferredKind || stored.localModelKind || "turbo",
      );
    }
    if ($("hf-repo")) {
      $("hf-repo").value = stored.customModelInput || stored.customModelRepo || "";
    }
    syncFields();
    paint();
    if (isLocal()) void queryLocal();
  } catch (err) {
    paint({ text: friendly(err), kind: "warn" });
  }
}

async function save() {
  await chrome.storage.local.set({
    provider: $("provider").value,
    apiKey: $("apiKey").value.trim(),
    language: $("language").value,
    customModelInput: $("hf-repo")?.value.trim() || "",
  });
  paint({ text: "Guardado.", kind: "ok" });
}

async function commitModel() {
  const kind = normalizeKind($("model")?.value);
  const download = $("download");
  const action = download?.dataset.action || "download";
  if (action === "wait" || action === "ready") return;
  if (action === "wake") {
    chrome.runtime.sendMessage({ type: "VOZCLARA_MOTOR_WAKE" }).finally(() => {
      void queryLocal();
    });
    return;
  }
  void startDownload(kind);
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

async function startDownload(kind) {
  const want = normalizeKind(kind);
  const repo = want === "custom" ? ($("hf-repo")?.value.trim() || "") : "";
  const parsed = parseHfRepo(repo);
  if (want === "custom" && /nemotron|parakeet|fastconformer|canary|nemo[-_]?asr/i.test(parsed)) {
    paint({
      text: "Escolha Nemotron no seletor. A extensão baixa o instalador do PC.",
      kind: "warn",
    });
    return;
  }
  if (want === "custom" && !parsed) {
    paint({
      text: "Cole um link do Hugging Face, tipo openai/whisper-tiny.",
      kind: "warn",
    });
    return;
  }
  renderLocal({
    downloading: true,
    ready: false,
    percent: 1,
    kind: want,
    label: globalThis.VCShared.downloadLabel(want, repo),
  });
  await chrome.storage.local.set({
    provider: "local",
    customModelInput: repo,
    preferredKind: want,
  });
  $("provider").value = "local";
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
      text: "Deixe a aba aberta até Pronto. Pode fechar este painel.",
      kind: "ok",
    });
  } catch (err) {
    renderLocal({
      downloading: false,
      ready: false,
      percent: 0,
      error: friendly(err),
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void load();
  $("provider").addEventListener("change", () => {
    syncFields();
    void save();
    if (isLocal()) void queryLocal();
    else paint();
  });
  $("language").addEventListener("change", () => void save());
  $("apiKey").addEventListener("change", () => void save());
  $("model")?.addEventListener("change", () => {
    syncFields();
    void queryLocal();
  });
  $("hf-repo")?.addEventListener("change", () => void save());
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
    changes.localModelId
  ) {
    void queryLocal();
  }
});
