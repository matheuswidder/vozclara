// Parte 6: normalizeKind/parseHfRepo vêm de shared.js (VCShared) — carregado
// antes deste arquivo em popup.html e options.html. Cópias em background.js e
// offscreen.js ficam com "// SYNC: shared.js" e teste de sync (extension/tests).
const normalizeKind = (k) => globalThis.VCShared.normalizeKind(k);
const parseHfRepo = (r) => globalThis.VCShared.parseHfRepo(r);

const $ = (id) => document.getElementById(id);

let lastPreferred = "turbo";
let motorPoll = null;

function metaOf(kind) {
  return globalThis.VCShared.modelMeta(kind);
}

function flashEl(el) {
  if (!el) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

function watchMotor(state) {
  const selected = normalizeKind($("model")?.value);
  const busy =
    selected === "nemotron" && Boolean(state?.motorAlive) && !state?.motorUp;
  const gBusy = Boolean(state?.gemma?.loading || state?.gemmaWaiting);
  if ((busy || gBusy) && !motorPoll) {
    motorPoll = setInterval(() => void queryLocal(), 1500);
  } else if (!busy && !gBusy && motorPoll) {
    clearInterval(motorPoll);
    motorPoll = null;
  }
}

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
  const status = $("local-status") || $("status");
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
  const motorPanel = $("motor-panel");
  const isNemo = selected === "nemotron";
  if (motorPanel) motorPanel.hidden = !isNemo;

  if (isNemo) {
    const view = globalThis.VCShared.motorView(state);
    const motorText = $("motor-text");
    const modelText = $("model-text");
    const motorDot = $("motor-dot");
    const modelDot = $("model-dot");
    const motorMeter = $("motor-meter");
    const motorBar = $("motor-bar");
    if (motorText) motorText.textContent = view.motor.text;
    if (modelText) modelText.textContent = view.model.text;
    if (motorDot) motorDot.className = `dot ${view.motor.kind || "off"}`;
    if (modelDot) modelDot.className = `dot ${view.model.kind || "off"}`;
    if (motorMeter && motorBar) {
      const show =
        Boolean(state?.motorAlive) &&
        !state?.motorUp &&
        (view.model.percent > 0 || view.model.indeterminate);
      motorMeter.hidden = !show;
      motorMeter.classList.toggle("indeterminate", Boolean(view.model.indeterminate));
      motorBar.style.width = `${Math.max(0, Math.min(100, view.model.percent || 8))}%`;
    }
    if (localStatus) {
      localStatus.textContent = error || view.model.text;
      localStatus.dataset.kind = error
        ? "warn"
        : state?.motorUp
          ? "ok"
          : "warn";
    }
    if (meter) meter.hidden = true;
    if (pathEl) pathEl.hidden = true;
  } else if (localStatus) {
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
    const showBar =
      !isNemo && (downloading || (percent > 0 && percent < 100 && !ready));
    meter.hidden = !showBar;
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  download.disabled = action.disabled;
  download.dataset.action = action.id;
  download.textContent = action.label;

  if (reveal) {
    reveal.hidden = isNemo || action.id !== "ready";
    reveal.disabled = downloading || action.id !== "ready";
  }

  if (action.id === "ready" && !isNemo) {
    chrome.storage.local.set({ preferredKind: selected }).catch(() => {});
  }
  watchMotor(state);
  renderGemma(state);
}

function selectedGemma() {
  return globalThis.VCShared.normalizeGemma(
    document.querySelector('input[name="gemma-kind"]:checked')?.value || "it",
  );
}

function renderGemma(state) {
  const btn = $("gemma-download");
  const status = $("gemma-status");
  const meter = $("gemma-meter");
  const bar = $("gemma-bar");
  if (!btn && !status) return;
  const action = globalThis.VCShared.gemmaAction(state, selectedGemma());
  const view = globalThis.VCShared.gemmaView(state);
  const motorText = $("g-motor-text");
  const modelText = $("g-model-text");
  const motorDot = $("g-motor-dot");
  const modelDot = $("g-model-dot");
  if (motorText) motorText.textContent = view.motor.text;
  if (modelText) modelText.textContent = view.model.text;
  if (motorDot) motorDot.className = `dot ${view.motor.kind || "off"}`;
  if (modelDot) modelDot.className = `dot ${view.model.kind || "off"}`;
  if (status) {
    status.textContent = action.status;
    status.dataset.kind = action.kind || "";
  }
  if (btn) {
    btn.disabled = action.disabled;
    btn.dataset.action = action.id;
    btn.textContent = action.label;
  }
  if (meter && bar) {
    meter.hidden = action.id !== "wait";
    meter.classList.toggle("indeterminate", action.id === "wait" && !(action.percent > 0));
    bar.style.width = `${Math.max(8, Number(action.percent) || 8)}%`;
  }
}

async function startGemma() {
  const kind = selectedGemma();
  if ($("gemma-on")) $("gemma-on").checked = true;
  syncGemma();
  await save();
  const btn = $("gemma-download");
  if (btn?.dataset.action === "wait") return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "…";
  }
  try {
    const result = await chrome.runtime.sendMessage({
      type: "VOZCLARA_GEMMA_LOAD",
      kind,
    });
    if (!result?.ok && !result?.waiting) {
      throw new Error(result?.error || "Não baixei o Gemma.");
    }
  } catch (err) {
    const status = $("gemma-status");
    if (status) {
      status.textContent = friendly(err);
      status.dataset.kind = "warn";
    }
    if (btn) btn.disabled = false;
  }
  void queryLocal();
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
      "cachedKinds",
      "preferredKind",
    ]);
    renderLocal({
      ready: Boolean(stored.localModelReady),
      downloading: Boolean(stored.localProgress?.downloading),
      percent: stored.localProgress?.percent || (stored.localModelReady ? 100 : 0),
      label: stored.localProgress?.label,
      error: stored.localProgress?.error,
      model: stored.localModelId,
      kind: stored.preferredKind || stored.localModelKind,
      device: stored.localModelDevice,
      cachedKinds: stored.cachedKinds,
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
      "gemmaOn",
      "gemmaKind",
      "gemmaWho",
      "gemmaTone",
      "gemmaNotes",
    ]);
    $("provider").value = stored.provider || "local";
    $("apiKey").value = stored.apiKey || "";
    $("language").value = stored.language || "pt";
    if ($("model")) {
      lastPreferred = normalizeKind(
        stored.preferredKind || stored.localModelKind || "turbo",
      );
      $("model").value = lastPreferred;
    }
    if ($("hf-repo")) {
      $("hf-repo").value = stored.customModelInput || stored.customModelRepo || "";
    }
    loadGemma(stored);
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
    ...gemmaPayload(),
  });
  paint({ text: "Guardado.", kind: "ok" });
}

function gemmaPayload() {
  const kind =
    document.querySelector('input[name="gemma-kind"]:checked')?.value || "it";
  return {
    gemmaOn: Boolean($("gemma-on")?.checked),
    gemmaKind: globalThis.VCShared.normalizeGemma(kind),
    gemmaWho: $("gemma-who")?.value.trim() || "",
    gemmaTone: $("gemma-tone")?.value || "cliente",
    gemmaNotes: $("gemma-notes")?.value.trim() || "",
  };
}

function syncGemma() {
  const extra = $("gemma-extra");
  if (extra) extra.hidden = !$("gemma-on")?.checked;
}

function loadGemma(stored) {
  if ($("gemma-on")) $("gemma-on").checked = Boolean(stored.gemmaOn);
  const want = globalThis.VCShared.normalizeGemma(stored.gemmaKind);
  document.querySelectorAll('input[name="gemma-kind"]').forEach((el) => {
    el.checked = el.value === want;
  });
  if ($("gemma-who")) $("gemma-who").value = stored.gemmaWho || "";
  if ($("gemma-tone")) $("gemma-tone").value = stored.gemmaTone || "cliente";
  if ($("gemma-notes")) $("gemma-notes").value = stored.gemmaNotes || "";
  syncGemma();
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
    if (probe?.cached && kind !== "nemotron") {
      lastPreferred = kind;
      void startDownload(kind, { switching: true });
      return;
    }
    if (kind === "nemotron") {
      void queryLocal();
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
  if (action === "wake") {
    chrome.runtime.sendMessage({ type: "VOZCLARA_MOTOR_WAKE" }).finally(() => {
      void queryLocal();
    });
    return;
  }
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
  $("model")?.addEventListener("change", () => void onModelChange());
  $("hf-repo")?.addEventListener("change", () => void save());
  $("gemma-on")?.addEventListener("change", () => {
    syncGemma();
    void save();
  });
  document.querySelectorAll('input[name="gemma-kind"]').forEach((el) => {
    el.addEventListener("change", () => {
      if ($("gemma-on")) $("gemma-on").checked = true;
      syncGemma();
      void save();
      void queryLocal();
    });
  });
  $("gemma-download")?.addEventListener("click", () => void startGemma());
  $("gemma-who")?.addEventListener("change", () => void save());
  $("gemma-tone")?.addEventListener("change", () => void save());
  $("gemma-notes")?.addEventListener("change", () => void save());
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
