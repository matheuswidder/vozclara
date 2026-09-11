function normalizeKind(kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "v3" || k === "precise" || k === "large" || k === "large-v3") return "v3";
  if (k === "light" || k === "small") return "light";
  if (k === "tiny") return "tiny";
  if (k === "nemotron") return "nemotron";
  if (k === "custom") return "custom";
  return "turbo";
}

function parseHfRepo(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/^https?:\/\/huggingface\.co\//i, "");
  s = s.replace(/^hf:\/\//i, "");
  s = s.split("?")[0].split("#")[0];
  s = s.replace(/\/(tree|blob|resolve|discussions|commits)\/.*$/i, "");
  s = s.replace(/\/+$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return `${parts[0]}/${parts[1]}`;
}

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
    status.textContent = "Whisper neste Chrome — o áudio não sai da máquina.";
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
  const label =
    state?.label ||
    (ready
      ? `Pronto · ${state.model || "Whisper"}`
      : downloading
        ? "Baixando Whisper…"
        : "Ainda não baixou. Um clique, uma vez.");

  if (localStatus) {
    localStatus.textContent = error || label;
    localStatus.dataset.kind = error
      ? "warn"
      : ready
        ? "ok"
        : downloading
          ? "warn"
          : "";
  }

  if (pathEl) {
    if (ready && !error) {
      pathEl.hidden = false;
      pathEl.textContent = state.folder
        ? `Pasta: Downloads/VozClara/${state.model || "Whisper"}`
        : `Neste Brave · ${state.fileCount || "?"} arquivos. Abrir no Explorer copia para Downloads/VozClara.`;
    } else {
      pathEl.hidden = true;
    }
  }

  if (meter && bar) {
    const showBar = downloading || (percent > 0 && percent < 100 && !ready);
    meter.hidden = !showBar;
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  const kind = normalizeKind(state?.kind);
  const selected = normalizeKind($("model")?.value);

  if (download) {
    download.disabled = downloading;
    const motorUp = Boolean(state?.motorUp);
    const motorInstalled = Boolean(state?.motorInstalled) || motorUp;
    download.dataset.wake = selected === "nemotron" && motorInstalled && !motorUp ? "1" : "";
    if (downloading) download.textContent = "Baixando…";
    else if (selected === "nemotron" && motorUp) download.textContent = "Na bandeja";
    else if (selected === "nemotron" && motorInstalled) download.textContent = "Ligar motor";
    else if (selected === "nemotron") download.textContent = "Instalar no PC";
    else if (ready && selected === kind) download.textContent = "Pronto";
    else download.textContent = "Baixar";
  }

  if (reveal) {
    reveal.hidden = false;
    reveal.disabled = downloading || !ready;
  }
}

async function queryLocal() {
  try {
    const state = await chrome.runtime.sendMessage({
      type: "VOZCLARA_MODEL_VERIFY",
    });
    if (state && typeof state === "object") {
      renderLocal(state);
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
    preferredKind: normalizeKind($("model")?.value),
    customModelInput: $("hf-repo")?.value.trim() || "",
  });
  paint({ text: "Guardado.", kind: "ok" });
}

async function apply() {
  await save();
  const hint = $("reload-hint");
  if (hint) hint.hidden = false;
  paint({
    text: "Aplicado. Recarregue o WhatsApp (F5) para valer.",
    kind: "ok",
  });
  const kind = normalizeKind($("model")?.value);
  const stored = await chrome.storage.local.get([
    "localModelKind",
    "localModelReady",
    "customModelRepo",
  ]);
  const sameRepo =
    kind !== "custom" ||
    parseHfRepo($("hf-repo")?.value) === parseHfRepo(stored.customModelRepo);
  if (!stored.localModelReady || normalizeKind(stored.localModelKind) !== kind || !sameRepo) {
    void startDownload(kind);
  }
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
    label:
      want === "nemotron"
        ? "Baixando o instalador do motor…"
        : want === "custom"
        ? `Baixando ${parseHfRepo(repo)}…`
        : want === "tiny"
          ? "Baixando o tiny…"
          : want === "light"
            ? "Baixando a versão leve…"
            : want === "v3"
              ? "Baixando o v3…"
              : "Abrindo o download…",
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
      text: "Download numa aba. Deixe-a aberta até Pronto.",
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
    download.addEventListener("click", () => {
      if (download.dataset.wake === "1") {
        chrome.runtime.sendMessage({ type: "VOZCLARA_MOTOR_WAKE" }).finally(() => {
          void queryLocal();
        });
        return;
      }
      void startDownload(normalizeKind($("model")?.value));
    });
  }
  $("apply")?.addEventListener("click", () => void apply());
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
