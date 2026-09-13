const MENU_ID = "vozclara-transcribe";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Transcrever com VozClara",
    contexts: ["all"],
    documentUrlPatterns: ["https://web.whatsapp.com/*"],
  });
});

chrome.runtime.onStartup.addListener(() => {
  void verifyModel();
  void pruneCache().catch(() => {});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "VOZCLARA_CONTEXT" });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "VOZCLARA_MODEL_STATUS") {
    modelStatus()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: true, ready: false }));
    return true;
  }
  if (msg?.type === "VOZCLARA_MODEL_VERIFY") {
    verifyModel()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, ready: false }));
    return true;
  }
  if (msg?.type === "VOZCLARA_MODEL_REVEAL") {
    revealModel()
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Não abri o Explorer.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_MODEL_DOWNLOAD") {
    if (sender.tab?.id && msg.requestId) {
      setProgressTarget(sender.tab.id, msg.requestId, msg.key);
    }
    sendResponse({ ok: true, started: true });
    void beginDownload(normalizeKind(msg.kind), msg.repo);
    return false;
  }
  if (msg?.type === "VOZCLARA_MODEL_PROBE") {
    probeKind(msg.kind, msg.repo)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          cached: false,
          error: err instanceof Error ? err.message : "Não verifiquei o modelo.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_MOTOR_WAKE") {
    wakeMotor()
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Não liguei o motor.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_PROBE") {
    probeLocal(msg.url)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Motor local inacessível.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_STT") {
    if (sender.tab?.id && msg.requestId) {
      setProgressTarget(sender.tab.id, msg.requestId, msg.key);
    }
    transcribe(msg, sender.tab?.id)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Falha ao transcrever.",
        }),
      )
      .finally(() => clearProgressTarget(msg.requestId));
    return true;
  }
  if (msg?.type === "VOZCLARA_STT_CANCEL") {
    cancelRequest(msg.requestId, sender.tab?.id);
    sendResponse({ ok: true, cancelled: true });
    return true;
  }
  if (msg?.type === "VOZCLARA_GEMMA_LOAD") {
    loadGemmaMotor(msg.kind)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Não baixei o Gemma.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_SUGGEST") {
    suggestReplies(msg.text)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Não sugeri.",
        }),
      );
    return true;
  }
  return false;
});

let activeTabId = null;
let whisperPort = null;
const pending = new Map();
/** @type {Set<string>} Parte 7.4: resultados de requisições canceladas a ignorar */
const cancelledRequests = new Set();
/** @type {null | { tabId: number, requestId: string, key: string }} */
let progressTarget = null;
let keepTimer = null;

function setProgressTarget(tabId, requestId, key) {
  if (tabId && requestId) {
    progressTarget = { tabId, requestId, key: key || "" };
  }
}

function clearProgressTarget(requestId) {
  if (!requestId || progressTarget?.requestId === requestId) progressTarget = null;
}

function tabForProgress() {
  return progressTarget?.tabId || activeTabId || null;
}

function forwardToCard(payload) {
  const tabId = tabForProgress();
  if (!tabId) return;
  chrome.tabs
    .sendMessage(tabId, {
      type: "VOZCLARA_PROGRESS",
      requestId: payload.requestId || progressTarget?.requestId,
      key: payload.key || progressTarget?.key,
      phase: payload.phase,
      percent: payload.percent,
      label: payload.label,
      detail: payload.detail,
      ready: payload.ready,
    })
    .catch(() => {});
}

function cancelRequest(requestId, tabId) {
  if (!requestId) return;
  cancelledRequests.add(requestId);
  for (const [id, job] of pending) {
    if (job.requestId === requestId) {
      pending.delete(id);
      keepAwake();
      try {
        job.resolve({ ok: false, cancelled: true, requestId });
      } catch {
        /* already settled */
      }
    }
  }
  const dest = tabId || progressTarget?.tabId || activeTabId;
  if (dest) {
    chrome.tabs
      .sendMessage(dest, {
        type: "VOZCLARA_STT_CANCELLED",
        requestId,
        key: progressTarget?.key,
      })
      .catch(() => {});
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "vozclara-whisper") return;
  whisperPort = port;
  port.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "VOZCLARA_MODEL_PROGRESS") {
      updateBadge(msg);
      persistProgress(msg);
      if (msg.label || msg.percent != null || msg.ready) {
        forwardToCard({
          phase: "download",
          percent: msg.percent,
          label: msg.label,
          detail: msg.detail,
          ready: msg.ready,
        });
      }
      return;
    }
    // Parte 1.3: progresso do caminho STT (fases ①/②/③) com requestId/key.
    if (msg.type === "VOZCLARA_STT_PROGRESS") {
      forwardToCard({
        requestId: msg.requestId,
        key: msg.key,
        phase: msg.phase,
        percent: msg.percent,
        label: msg.label,
        detail: msg.detail,
      });
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const job = pending.get(msg.id);
      pending.delete(msg.id);
      keepAwake();
      job.resolve(msg);
    }
  });
  port.onDisconnect.addListener(() => {
    if (whisperPort === port) whisperPort = null;
    for (const [id, job] of pending) {
      job.reject(
        new Error("O motor Whisper reiniciou. Clique de novo em Baixar Whisper."),
      );
      pending.delete(id);
    }
    keepAwake();
  });
});

function keepAwake() {
  const busy = pending.size > 0;
  if (busy && !keepTimer) {
    keepTimer = setInterval(() => {
      chrome.runtime.getPlatformInfo(() => {});
    }, 20000);
  }
  if (!busy && keepTimer) {
    clearInterval(keepTimer);
    keepTimer = null;
  }
}

function updateBadge(msg) {
  try {
    if (msg.error) {
      chrome.action.setBadgeBackgroundColor({ color: "#c45c5c" });
      chrome.action.setBadgeText({ text: "!" });
      return;
    }
    if (msg.ready && !msg.downloading) {
      chrome.action.setBadgeBackgroundColor({ color: "#5dcaa0" });
      chrome.action.setBadgeText({ text: "OK" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
      return;
    }
    if (msg.downloading) {
      chrome.action.setBadgeBackgroundColor({ color: "#5dcaa0" });
      const n = Math.max(1, Math.min(99, Number(msg.percent) || 1));
      chrome.action.setBadgeText({ text: String(n) });
    }
  } catch {
    /* ignore */
  }
}

function persistProgress(msg) {
  try {
    const patch = {
      localProgress: {
        percent: Number(msg.percent) || 0,
        label: msg.label || "",
        downloading: Boolean(msg.downloading),
        error: msg.error || "",
      },
    };
    if (msg.ready) {
      patch.localModelReady = true;
      if (msg.model) patch.localModelId = msg.model;
      if (msg.kind) patch.localModelKind = msg.kind;
      if (msg.device) patch.localModelDevice = msg.device;
    }
    if (msg.error) patch.localModelReady = false;
    chrome.storage.local.set(patch);
  } catch {
    /* ignore */
  }
}

function friendlyError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/reading ['"]local['"]/i.test(raw)) {
    return "O motor interno falhou ao iniciar. Recarregue a extensão e clique de novo em Baixar Whisper.";
  }
  if (/message port closed/i.test(raw)) {
    return "O painel do ícone fechou. O download segue na aba da VozClara.";
  }
  if (/Failed to fetch|NetworkError|NETWORK|CORS|blocked/i.test(raw)) {
    return "O Brave bloqueou o download. Nos Escudos, libere huggingface.co para esta extensão.";
  }
  if (/quota|QuotaExceeded/i.test(raw)) {
    return "Sem espaço neste navegador para o modelo. Tente a versão leve.";
  }
  if (/single offscreen|Only a single/i.test(raw)) {
    return "O motor já está ligando. Espere um instante e veja a aba da VozClara.";
  }
  if (/createObjectURL is not a function/i.test(raw)) {
    return "Não deu para abrir o Explorer. Recarregue a extensão e tente de novo.";
  }
  if (/Unable to decode audio data|decode audio|Não li este Opus|OGG sem pacotes|AudioDecoder/i.test(raw)) {
    return "Não li o Opus deste áudio. Recarregue a extensão (versão nova) e clique de novo em Transcrever.";
  }
  if (/Failed to resolve module|Cannot find module|onnxruntime/i.test(raw)) {
    return "Falta o motor Whisper neste zip. Baixe o pacote de novo e recarregue a extensão.";
  }
  return raw;
}

async function hasOffscreen() {
  try {
    if (chrome.offscreen.hasDocument) return await chrome.offscreen.hasDocument();
  } catch {
    /* ignore */
  }
  const ctx = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return ctx.length > 0;
}

async function createOffscreen() {
  const tries = [
    ["BLOBS", "DOM_SCRAPING"],
    ["BLOBS"],
    ["DOM_SCRAPING"],
    ["AUDIO_PLAYBACK"],
    ["WORKERS", "BLOBS"],
  ];
  let last = new Error("Não consegui ligar o Whisper neste navegador.");
  for (const reasons of tries) {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons,
        justification: "Baixar e rodar Whisper neste navegador, sem enviar o áudio.",
      });
      return;
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (/single offscreen|already exists|Only a single/i.test(text)) return;
      last = err instanceof Error ? err : new Error(text);
    }
  }
  throw last;
}

function waitForPort(ms) {
  if (whisperPort) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = setInterval(() => {
      if (whisperPort) {
        clearInterval(tick);
        resolve();
      } else if (Date.now() - start > ms) {
        clearInterval(tick);
        reject(
          new Error(
            "Não consegui ligar o Whisper. Recarregue a extensão na página de extensões e tente de novo.",
          ),
        );
      }
    }, 50);
  });
}

async function ensureOffscreen() {
  if (whisperPort) return;
  if (await hasOffscreen()) {
    try {
      await waitForPort(1500);
      return;
    } catch {
      try {
        await chrome.offscreen.closeDocument();
      } catch {
        /* ignore */
      }
    }
  }
  await createOffscreen();
  try {
    await waitForPort(8000);
  } catch {
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      /* ignore */
    }
    await createOffscreen();
    await waitForPort(8000);
  }
}

function callOffscreen(payload, timeoutMs) {
  if (!whisperPort) {
    return Promise.reject(new Error("Motor Whisper desligado."));
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      keepAwake();
      reject(new Error("O Whisper demorou demais."));
    }, timeoutMs);
    pending.set(id, {
      requestId: payload.requestId,
      resolve: (msg) => {
        clearTimeout(timer);
        resolve(msg);
      },
    });
    keepAwake();
    try {
      whisperPort.postMessage({ ...payload, id });
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      keepAwake();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function storedStatus() {
  const stored = await chrome.storage.local.get([
    "localModelReady",
    "localModelId",
    "localModelKind",
    "localModelDevice",
    "localProgress",
    "customModelRepo",
    "customModelInput",
    "preferredKind",
    "cachedKinds",
  ]);
  return {
    ok: true,
    ready: Boolean(stored.localModelReady),
    downloading: Boolean(stored.localProgress?.downloading),
    percent: stored.localProgress?.percent || (stored.localModelReady ? 100 : 0),
    label: stored.localProgress?.label,
    error: stored.localProgress?.error,
    model: stored.localModelId,
    kind: stored.preferredKind || stored.localModelKind,
    device: stored.localModelDevice,
    customRepo: stored.customModelRepo || stored.customModelInput || "",
    cachedKinds: Array.isArray(stored.cachedKinds) ? stored.cachedKinds : [],
  };
}

async function modelStatus() {
  return storedStatus();
}

function openProgressTab() {
  chrome.runtime.openOptionsPage().catch(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  });
}

const MODEL_REPOS = {
  turbo: {
    repo: "onnx-community/whisper-large-v3-turbo",
    label: "large-v3-turbo",
  },
  v3: {
    repo: "onnx-community/whisper-large-v3",
    label: "large-v3",
  },
  tiny: {
    repo: "onnx-community/whisper-tiny",
    label: "whisper-tiny",
  },
  light: {
    repo: "onnx-community/whisper-small",
    label: "whisper-small",
  },
};

// SYNC: shared.js — cópia quente (SW clássico não importa módulos); o teste
// extension/tests/shared-sync.test.mjs falha se divergir.
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

function candidateRepos(repo) {
  const parsed = parseHfRepo(repo);
  if (!parsed) return [];
  const [org, name] = parsed.split("/");
  const list = [];
  const add = (r) => {
    if (r && !list.includes(r)) list.push(r);
  };
  if (/^(onnx-community|Xenova)$/i.test(org)) add(parsed);
  else {
    add(`onnx-community/${name}`);
    add(`Xenova/${name}`);
    add(parsed);
  }
  return list;
}

function fileNameFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "resolve" || p === "blob");
    const rest = idx >= 0 ? parts.slice(idx + 2) : parts.slice(-2);
    return rest.join("/") || parts.at(-1) || "arquivo";
  } catch {
    return "arquivo";
  }
}

function safeRel(name) {
  return String(name || "arquivo")
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..")
    .join("/")
    .replace(/[<>:"|?*]/g, "_");
}

async function scanModelCache(kind, repo) {
  const want = normalizeKind(kind);
  if (want === "nemotron") {
    return {
      kind: want,
      model: "nemotron-3.5-asr",
      files: [],
      fileCount: 0,
      onnxCount: 0,
      ready: false,
    };
  }
  const parsed = parseHfRepo(repo || "");
  const spec =
    want === "custom" && parsed
      ? { repo: parsed, label: parsed.split("/")[1] || parsed }
      : MODEL_REPOS[want] || MODEL_REPOS.turbo;
  const needles = want === "custom" ? candidateRepos(parsed) : [spec.repo];
  const files = [];
  let names = [];
  try {
    names = await caches.keys();
  } catch {
    names = [];
  }
  for (const name of names) {
    let cache;
    let keys = [];
    try {
      cache = await caches.open(name);
      keys = await cache.keys();
    } catch {
      continue;
    }
    for (const req of keys) {
      const url = req.url || "";
      if (!needles.some((n) => n && url.includes(n))) continue;
      files.push({
        cache: name,
        url,
        name: fileNameFromUrl(url),
        onnx: /\.onnx/i.test(url),
      });
    }
  }
  const has = (suffix) =>
    files.some((f) => f.name.toLowerCase().endsWith(suffix));
  const hasTokenizer = has("tokenizer.json") || has("tokenizer_config.json");
  const onnxFiles = files.filter((f) => f.onnx);
  const essentialsComplete =
    has("config.json") &&
    has("preprocessor_config.json") &&
    hasTokenizer &&
    onnxFiles.length >= 1;
  let onnxValid = false;
  if (essentialsComplete) {
    for (const file of onnxFiles) {
      try {
        const res = await caches
          .open(file.cache)
          .then((c) => c.match(file.url));
        if (!res) continue;
        const length = Number(res.headers.get("content-length") || "0");
        const size = length > 0 ? length : (await res.blob()).size;
        if (size > 1_000_000) {
          onnxValid = true;
          break;
        }
      } catch {
        /* tenta o próximo */
      }
    }
  }
  const onnxCount = onnxFiles.length;
  return {
    kind: want,
    model: spec.label,
    files,
    fileCount: files.length,
    onnxCount,
    ready: essentialsComplete && onnxValid,
  };
}

async function markCached(kind) {
  const want = normalizeKind(kind);
  if (want === "nemotron" || want === "custom") return;
  const stored = await chrome.storage.local.get(["cachedKinds"]);
  const list = Array.isArray(stored.cachedKinds) ? stored.cachedKinds.slice() : [];
  if (!list.includes(want)) list.push(want);
  await chrome.storage.local.set({ cachedKinds: list });
}

async function scanKnownKinds() {
  const kinds = ["tiny", "light", "turbo", "v3"];
  const cached = [];
  for (const k of kinds) {
    try {
      const disk = await scanModelCache(k);
      if (disk.ready) cached.push(k);
    } catch {
      /* ignore */
    }
  }
  await chrome.storage.local.set({ cachedKinds: cached });
  return cached;
}

async function probeKind(kind, repo) {
  const want = normalizeKind(kind);
  if (want === "nemotron") {
    const extra = await chrome.storage.local.get(["localUrl", "motorInstalled"]);
    const probe = await probeLocal(extra.localUrl);
    const alive = Boolean(probe?.ok);
    const up = Boolean(probe?.ok && probe.ready);
    return {
      ok: true,
      kind: want,
      cached: Boolean(extra.motorInstalled) || alive || up,
      ready: up,
      motorUp: up,
      motorAlive: alive,
      motorInstalled: Boolean(extra.motorInstalled) || alive || up,
    };
  }
  const disk = await scanModelCache(want, repo);
  if (disk.ready) await markCached(want);
  const stored = await chrome.storage.local.get(["cachedKinds"]);
  return {
    ok: true,
    kind: want,
    cached: disk.ready,
    ready: disk.ready,
    model: disk.model,
    cachedKinds: Array.isArray(stored.cachedKinds) ? stored.cachedKinds : [],
  };
}

async function existingExport() {
  if (!chrome.downloads?.search) return null;
  const stored = await chrome.storage.local.get(["localExportIds"]);
  const ids = Array.isArray(stored.localExportIds) ? stored.localExportIds : [];
  for (const id of ids) {
    try {
      const items = await chrome.downloads.search({ id });
      const item = items.find((row) => row.id === id);
      if (item && item.state === "complete" && item.exists !== false) {
        return { id: item.id, filename: item.filename || "" };
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const items = await chrome.downloads.search({
      filenameRegex: "VozClara",
      exists: true,
      limit: 40,
      orderBy: ["-startTime"],
    });
    const hit = items.find(
      (row) => row.exists !== false && /VozClara/i.test(row.filename || ""),
    );
    if (hit) return { id: hit.id, filename: hit.filename || "" };
  } catch {
    /* ignore */
  }
  return null;
}

function waitDownload(id) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 10 * 60 * 1000);
    const onChange = (delta) => {
      if (delta.id !== id) return;
      const state = delta.state?.current;
      if (state === "complete") {
        chrome.downloads.onChanged.removeListener(onChange);
        clearTimeout(timer);
        resolve(true);
      }
      if (state === "interrupted") {
        chrome.downloads.onChanged.removeListener(onChange);
        clearTimeout(timer);
        resolve(false);
      }
    };
    chrome.downloads.onChanged.addListener(onChange);
  });
}

async function verifyModel(opts = {}) {
  const stored = await storedStatus();
  const kind = normalizeKind(stored.kind);
  if (kind === "nemotron") {
    const extra = await chrome.storage.local.get(["localUrl", "motorInstalled"]);
    const probe = await probeLocal(extra.localUrl);
    const alive = Boolean(probe?.ok);
    const up = Boolean(probe?.ok && probe.ready);
    if (up) {
      await chrome.storage.local.set({
        localModelReady: true,
        motorInstalled: true,
        localProgress: {
          downloading: false,
          percent: 100,
          error: "",
          label: `Pronto · ${probe.model || "Nemotron"} na bandeja`,
        },
      });
    }
    const loadingLabel = probe?.error
      ? `Motor ligado, mas o modelo falhou: ${probe.error}`
      : probe?.detail ||
        (probe?.phase === "download"
          ? `Baixando o modelo… ${probe.percent || 0}%`
          : probe?.phase === "deps"
            ? "Instalando bibliotecas no PC…"
            : "Carregando o modelo na memória…");
    const percent =
      up
        ? 100
        : Number(probe?.percent) > 0
          ? Number(probe.percent)
          : 0;
    return withGemma({
      ok: true,
      checked: true,
      ready: up,
      motorUp: up,
      motorAlive: alive,
      motorInstalled: Boolean(extra.motorInstalled) || alive || up,
      downloading: false,
      phase: probe?.phase || (up ? "ready" : alive ? "load" : ""),
      percent,
      detail: probe?.detail || "",
      model: probe?.model || stored.model || "nemotron-3.5-asr",
      kind: "nemotron",
      label: up
        ? `Pronto · ${probe.model || "Nemotron"} — ao lado do relógio`
        : alive
          ? loadingLabel
          : extra.motorInstalled
            ? "Não alcanço o motor. Clique em Ligar o motor."
            : "Instale o motor Windows. Ele fica em segundo plano, na bandeja.",
      error: up ? "" : alive ? probe?.error || "" : extra.motorInstalled ? "Não alcanço o motor neste PC." : "",
    });
  }
  const disk = await scanModelCache(kind, stored.customRepo || stored.customModelRepo);
  const folder = await existingExport();
  const downloading = Boolean(stored.downloading);
  let cachedKinds = Array.isArray(stored.cachedKinds) ? stored.cachedKinds : [];
  if (!downloading) {
    try {
      cachedKinds = await scanKnownKinds();
    } catch {
      /* keep */
    }
  }
  if (!downloading && disk.ready && !stored.ready) {
    await chrome.storage.local.set({
      localModelReady: true,
      localModelId: disk.model,
      localModelKind: disk.kind,
      localProgress: {
        downloading: false,
        percent: 100,
        error: "",
        label: `Pronto · ${disk.model}`,
      },
    });
  }
  if (!downloading && !disk.ready && stored.ready && !stored.downloading) {
    await chrome.storage.local.set({
      localModelReady: false,
      localProgress: {
        downloading: false,
        percent: 0,
        error: "Download incompleto — baixe de novo.",
        label: "Download incompleto — baixe de novo.",
      },
    });
  }
  const fresh = await storedStatus();
  return withGemma({
    ...fresh,
    ok: true,
    checked: true,
    cachedKinds,
    fileCount: disk.fileCount,
    onnxCount: disk.onnxCount,
    folder: folder?.filename || "",
    ready: downloading ? false : Boolean(disk.ready),
    label:
      !downloading && !disk.ready && stored.ready
        ? "Download incompleto — baixe de novo."
        : fresh.label,
  });
}

async function revealModel() {
  if (!chrome.downloads?.download && !chrome.downloads?.show) {
    throw new Error("Recarregue a extensão para liberar o Explorer.");
  }
  const existing = await existingExport();
  if (existing) {
    chrome.downloads.show(existing.id);
    return { ok: true, shown: true, folder: existing.filename };
  }
  const stored = await storedStatus();
  const kind = normalizeKind(stored.kind);
  persistProgress({
    downloading: true,
    ready: true,
    percent: 1,
    label: "Copiando para Downloads/VozClara…",
    model: stored.model,
    kind,
  });
  try {
    await ensureOffscreen();
    const result = await callOffscreen({ action: "export", kind }, 10 * 60 * 1000);
    if (!result?.ok) {
      throw new Error(result?.error || "Não copiei os arquivos para o Downloads.");
    }
    const ids = Array.isArray(result.ids) ? result.ids : [];
    await chrome.storage.local.set({
      localExportIds: ids,
      localExportKind: kind,
    });
    const showId = ids[ids.length - 1];
    if (showId) {
      await waitDownload(showId);
      chrome.downloads.show(showId);
    }
    if (!ids.length) {
      throw new Error("Não consegui copiar os arquivos para o Downloads.");
    }
    return {
      ok: true,
      shown: true,
      copied: ids.length,
      folder: `Downloads/VozClara/${result.model || stored.model || "Whisper"}`,
    };
  } finally {
    persistProgress({
      downloading: false,
      ready: true,
      percent: 100,
      label: `Pronto · ${stored.model || "Whisper"}`,
      model: stored.model,
      kind,
      error: "",
    });
  }
}

async function beginDownload(kind, repo) {
  const want = normalizeKind(kind);
  if (want === "nemotron") {
    await beginNemotron();
    return;
  }
  const parsed = parseHfRepo(repo || "");
  const disk = await scanModelCache(want, parsed);
  const switching = Boolean(disk.ready);
  const label = switching
    ? `Trocando para ${disk.model}…`
    : want === "custom"
      ? `Baixando ${parsed || "modelo"}…`
      : `Baixando ${disk.model}…`;
  await chrome.storage.local.set({
    provider: "local",
    preferredKind: want,
    customModelInput: repo || "",
    customModelRepo: parsed,
    localProgress: {
      downloading: !switching,
      percent: switching ? 70 : 1,
      label,
      error: "",
    },
  });
  updateBadge({ downloading: !switching, percent: switching ? 70 : 1 });
  if (!switching) openProgressTab();
  try {
    await ensureOffscreen();
    const result = await callOffscreen(
      { action: "load", kind: want, repo: parsed },
      15 * 60 * 1000,
    );
    if (!result?.ok) {
      throw new Error(result?.error || "Não deu para baixar o Whisper.");
    }
    await markCached(result.kind || want);
    await chrome.storage.local.set({
      provider: "local",
      localModelReady: true,
      localModelId: result.model || "",
      localModelKind: result.kind || want,
      localModelDevice: result.device || "",
      customModelRepo: result.repo || parsed,
      preferredKind: result.kind || want,
      localProgress: {
        downloading: false,
        percent: 100,
        label: `Pronto · ${result.model || "Whisper"}`,
        error: "",
      },
    });
    updateBadge({ ready: true, downloading: false });
    void verifyModel({ silent: true });
  } catch (err) {
    const error = friendlyError(err);
    await chrome.storage.local.set({
      localModelReady: false,
      localProgress: {
        downloading: false,
        percent: 0,
        error,
        label: error,
      },
    });
    updateBadge({ error });
  }
}

async function transcribeInBrowser(msg, tabId) {
  activeTabId = tabId || null;
  try {
    await verifyModel({ silent: true });
    const stored = await chrome.storage.local.get([
      "localModelKind",
      "preferredKind",
      "customModelRepo",
    ]);
    await ensureOffscreen();
    // Parte 1.3: requestId/key viajam para o offscreen, que emite fases ①/③
    // com o id; o SW reencaminha ao card certo.
    if (msg.requestId) {
      forwardToCard({
        requestId: msg.requestId,
        key: msg.key,
        phase: "transcribe",
        label: "Transcrevendo…",
      });
    }
    const result = await callOffscreen(
      {
        action: "transcribe",
        requestId: msg.requestId,
        key: msg.key,
        audioBase64: msg.audioBase64,
        mimeType: msg.mimeType,
        language: msg.language,
        kind: normalizeKind(msg.kind || stored.preferredKind || stored.localModelKind),
        repo: msg.repo || stored.customModelRepo || "",
        byteLength: msg.byteLength,
      },
      15 * 60 * 1000,
    );
    if (msg.requestId && cancelledRequests.has(msg.requestId)) {
      cancelledRequests.delete(msg.requestId);
      return { ok: false, cancelled: true };
    }
    if (!result?.ok) {
      throw new Error(result?.error || "Whisper local falhou.");
    }
    return result;
  } finally {
    activeTabId = null;
  }
}

function audioBlobFromMsg(msg) {
  const mime = msg.mimeType || "audio/ogg";
  if (msg.audioBuffer instanceof ArrayBuffer && msg.audioBuffer.byteLength >= 64) {
    return new Blob([msg.audioBuffer.slice(0)], { type: mime });
  }
  if (ArrayBuffer.isView(msg.audioBuffer) && msg.audioBuffer.byteLength >= 64) {
    return new Blob(
      [
        msg.audioBuffer.buffer.slice(
          msg.audioBuffer.byteOffset,
          msg.audioBuffer.byteOffset + msg.audioBuffer.byteLength,
        ),
      ],
      { type: mime },
    );
  }
  if (typeof msg.audioBase64 === "string" && msg.audioBase64.length > 80) {
    const raw = atob(msg.audioBase64);
    const binary = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) binary[i] = raw.charCodeAt(i);
    return new Blob([binary], { type: mime });
  }
  return new Blob([], { type: mime });
}

function mimeToName(mime, fallback) {
  if (!mime) return fallback;
  if (mime.includes("ogg") || mime.includes("opus")) return "voice.ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "voice.mp3";
  if (mime.includes("wav")) return "voice.wav";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac"))
    return "voice.m4a";
  if (mime.includes("webm")) return "voice.webm";
  return fallback;
}

function asText(body) {
  if (body && typeof body.text === "string") return body.text.trim();
  return "";
}

async function transcribeOpenAI(blob, name, apiKey, language) {
  const models = ["gpt-4o-mini-transcribe", "whisper-1"];
  let last = "OpenAI recusou a transcrição.";
  for (const model of models) {
    const form = new FormData();
    form.append("file", new File([blob], name, { type: blob.type || "audio/ogg" }));
    form.append("model", model);
    if (language) form.append("language", language);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const text = asText(json);
      if (text) return text;
      last = "A OpenAI devolveu uma transcrição vazia.";
      continue;
    }
    last = json?.error?.message || `OpenAI ${res.status}`;
  }
  throw new Error(last);
}

async function transcribeGroq(blob, name, apiKey, language) {
  const form = new FormData();
  form.append("file", new File([blob], name, { type: blob.type || "audio/ogg" }));
  form.append("model", "whisper-large-v3");
  if (language) form.append("language", language);
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Groq ${res.status}`);
  const text = asText(json);
  if (!text) throw new Error("A Groq devolveu uma transcrição vazia.");
  return text;
}

async function transcribeXai(blob, name, apiKey, language) {
  const form = new FormData();
  if (language) form.append("language", language);
  form.append("format", "true");
  form.append("file", new File([blob], name, { type: blob.type || "audio/ogg" }));
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err =
      typeof json?.error === "string"
        ? json.error
        : json?.error?.message || `xAI ${res.status}`;
    throw new Error(err);
  }
  const text = asText(json);
  if (!text) throw new Error("A xAI devolveu uma transcrição vazia.");
  return text;
}

async function transcribeGemini(blob, apiKey, language) {
  const b64 = await blobToBase64(blob);
  const prompt = language
    ? `Transcreva este áudio fielmente. Idioma: ${language === "pt" ? "português brasileiro" : language}. Responda apenas com a transcrição, sem aspas nem comentários.`
    : "Transcreva este áudio fielmente. Responda apenas com a transcrição, sem aspas nem comentários.";
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let last = "Gemini recusou a transcrição.";
  for (const model of models) {
    // Parte 7.6: chave no header — nunca na query string (pode vazar em logs).
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: blob.type || "audio/ogg",
                    data: b64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const text = (json?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .trim();
      if (text) return text;
      last = "O Gemini devolveu uma transcrição vazia.";
      continue;
    }
    last = json?.error?.message || `Gemini ${res.status}`;
  }
  throw new Error(last);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler o áudio"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

async function hashBlob(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function localRoot(url) {
  const raw = (url || "http://127.0.0.1:8173").trim() || "http://127.0.0.1:8173";
  return raw.replace(/\/+$/, "");
}

function pairEndpoint(url) {
  return `${localRoot(url)}/pair`;
}

async function pairMotor(url) {
  const res = await fetch(pairEndpoint(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `Não pareei com o motor (${res.status}).`);
  }
  const token = typeof json?.token === "string" ? json.token.trim() : "";
  if (!token) throw new Error("O motor não devolveu um token válido.");
  await chrome.storage.local.set({ motorToken: token });
  return token;
}

async function motorToken() {
  const stored = await chrome.storage.local.get(["motorToken"]);
  const saved = typeof stored.motorToken === "string" ? stored.motorToken.trim() : "";
  if (saved) return saved;
  return pairMotor(undefined);
}

async function withGemma(status) {
  const extra = await chrome.storage.local.get(["localUrl", "gemmaKind", "gemmaOn"]);
  let probe = { ok: false };
  if (extra.gemmaOn || status.motorAlive) {
    try {
      probe = await probeLocal(extra.localUrl);
    } catch {
      probe = { ok: false };
    }
  }
  const g = probe?.gemma && typeof probe.gemma === "object" ? probe.gemma : {};
  const stale = Boolean(probe?.ok) && probe.gemma == null;
  await chrome.storage.local.set({
    gemmaReady: Boolean(g.ready),
    gemmaLoading: Boolean(g.loading),
    gemmaError: g.error || "",
    gemmaStale: stale,
  });
  return {
    ...status,
    motorAlive: Boolean(probe?.ok) || Boolean(status.motorAlive),
    motorUp: Boolean(probe?.ok && probe.ready) || Boolean(status.motorUp),
    gemmaStale: stale,
    gemma: {
      ready: Boolean(g.ready),
      loading: Boolean(g.loading),
      kind: g.kind || extra.gemmaKind || "it",
      percent: Number(g.percent) || 0,
      detail: g.detail || "",
      error: g.error || "",
      stale,
    },
  };
}

async function loadGemmaMotor(kind) {
  const want = String(kind || "it");
  await chrome.storage.local.set({ gemmaOn: true, gemmaKind: want, gemmaLoading: true });
  const extra = await chrome.storage.local.get(["localUrl"]);
  let probe = await probeLocal(extra.localUrl);
  if (!probe?.ok) {
    try {
      await wakeMotor();
    } catch {
      /* still try */
    }
    probe = await probeLocal(extra.localUrl);
  }
  if (!probe?.ok) {
    throw new Error("Ligue o motor na bandeja para baixar o Gemma.");
  }
  if (probe.gemma == null) {
    await downloadMotorZip();
    await chrome.storage.local.set({ gemmaStale: true, gemmaLoading: false });
    return {
      ok: false,
      needUpdate: true,
      error:
        "Baixei VozClara-Motor-Setup em Downloads. Feche o ícone da bandeja, rode o instalador, depois clique de novo em Baixar. A transcrição não some.",
    };
  }
  const root = localRoot(extra.localUrl) || "http://127.0.0.1:8173";
  let token = "";
  try {
    token = await motorToken();
  } catch {
    token = "";
  }
  const res = await fetch(`${root}/v1/gemma/load`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ kind: want }),
  });
  const json = await res.json().catch(() => null);
  if (res.status === 404) {
    await downloadMotorZip();
    await chrome.storage.local.set({ gemmaStale: true, gemmaLoading: false });
    return {
      ok: false,
      needUpdate: true,
      error:
        "Baixei VozClara-Motor-Setup em Downloads. Feche o ícone da bandeja, rode o instalador, depois clique de novo em Baixar. A transcrição não some.",
    };
  }
  if (res.status === 401) {
    try {
      token = await pairMotor(extra.localUrl);
    } catch {
      token = "";
    }
    const retry = await fetch(`${root}/v1/gemma/load`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind: want }),
    });
    const retryJson = await retry.json().catch(() => null);
    if (retry.ok) {
      return { ok: true, started: true, ready: Boolean(retryJson?.ready), kind: want };
    }
    throw new Error(
      (typeof retryJson?.error === "string" && retryJson.error) ||
        "O motor recusou o Gemma. Feche a bandeja e rode o instalador de novo.",
    );
  }
  if (!res.ok) {
    throw new Error((typeof json?.error === "string" && json.error) || "Não comecei o download do Gemma.");
  }
  return { ok: true, started: true, ready: Boolean(json?.ready), kind: want };
}

async function suggestReplies(text) {
  const stored = await chrome.storage.local.get([
    "gemmaOn",
    "gemmaKind",
    "gemmaWho",
    "gemmaTone",
    "gemmaNotes",
    "localUrl",
  ]);
  if (!stored.gemmaOn) return { ok: false, error: "Sugestão desligada." };
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "Não há texto para sugerir." };
  const probe = await probeLocal(stored.localUrl);
  if (!probe?.ok) {
    return { ok: false, error: "Ligue o motor na bandeja para o Gemma sugerir." };
  }
  if (!probe.gemma?.ready) {
    try {
      await loadGemmaMotor(stored.gemmaKind || "it");
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Baixe o Gemma no painel.",
      };
    }
    return {
      ok: false,
      error: "Baixando o Gemma no PC. Espere o Pronto no painel (~4 GB).",
    };
  }
  const root = localRoot(stored.localUrl) || "http://127.0.0.1:8173";
  let token = "";
  try {
    token = await motorToken();
  } catch {
    token = "";
  }
  const res = await fetch(`${root}/v1/suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text: raw,
      kind: stored.gemmaKind || "it",
      who: stored.gemmaWho || "",
      tone: stored.gemmaTone || "cliente",
      notes: stored.gemmaNotes || "",
    }),
  });
  const json = await res.json().catch(() => null);
  if (res.status === 404) {
    return { ok: false, error: "Motor antigo. A transcrição segue; para sugerir respostas, rode de novo o instalador." };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: (typeof json?.error === "string" && json.error) || "O Gemma não sugeriu.",
    };
  }
  const replies = Array.isArray(json?.replies)
    ? json.replies.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  if (!replies.length) {
    return { ok: false, error: "O Gemma não devolveu respostas." };
  }
  return { ok: true, replies, kind: json?.kind || stored.gemmaKind };
}

async function probeLocal(url) {
  const roots = [
    localRoot(url),
    "http://127.0.0.1:8173",
    "http://localhost:8173",
  ].filter((v, i, a) => v && a.indexOf(v) === i);
  let last = {
    ok: false,
    alive: false,
    ready: false,
    error: "Motor nativo desligado.",
  };
  for (const root of roots) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(`${root}/health`, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        return {
          ok: true,
          alive: true,
          ready: json?.ready === true,
          paired: json?.paired === true || json?.paired === "true",
          motorVersion: json?.version || "",
          model: json?.model,
          engine: json?.engine,
          error: json?.error || "",
          phase: json?.phase || (json?.ready ? "ready" : "load"),
          percent: Number(json?.percent) || (json?.ready ? 100 : 0),
          detail: json?.detail || "",
          gemma: json?.gemma || null,
        };
      }
      last = {
        ok: false,
        alive: false,
        ready: false,
        error: json?.error || `Motor local ${res.status}`,
      };
    } catch {
      last = {
        ok: false,
        alive: false,
        ready: false,
        error: "Não alcanço o motor. Clique em Ligar motor.",
      };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

async function wakeMotor() {
  try {
    const tab = await chrome.tabs.create({ url: "vozclara://run", active: false });
    if (tab?.id) {
      setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
      }, 2500);
    }
  } catch {
    /* o protocolo pode pedir confirmação */
  }
  const stored = await chrome.storage.local.get(["localUrl"]);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const probe = await probeLocal(stored.localUrl);
    if (probe?.ok && probe.ready) {
      await chrome.storage.local.set({
        localModelReady: true,
        motorInstalled: true,
        localProgress: {
          downloading: false,
          percent: 100,
          error: "",
          label: `Pronto · ${probe.model || "Nemotron"} na bandeja`,
        },
      });
      updateBadge({ ready: true, downloading: false });
      return { ok: true, ready: true, motorUp: true, motorAlive: true };
    }
    if (probe?.ok && !probe.ready) {
      await chrome.storage.local.set({
        motorInstalled: true,
        localProgress: {
          downloading: true,
          percent: Math.min(90, 20 + i * 2),
          error: "",
          label: probe.error || "Motor ligado. Carregando o Nemotron…",
        },
      });
    }
  }
  const late = await probeLocal(stored.localUrl);
  if (late?.ok && !late.ready) {
    return {
      ok: true,
      ready: false,
      motorAlive: true,
      motorUp: false,
      error: late.error || "Motor ligado, ainda carregando o modelo.",
    };
  }
  return {
    ok: false,
    ready: false,
    motorUp: false,
    error:
      "Não alcanço o motor. Clique de novo em Ligar motor.",
  };
}

async function downloadMotorZip() {
  const url = chrome.runtime.getURL("engine/VozClara-Motor-Setup.exe");
  try {
    const id = await chrome.downloads.download({
      url,
      filename: "VozClara-Motor-Setup.exe",
      saveAs: false,
      conflictAction: "uniquify",
    });
    await chrome.storage.local.set({ motorInstalled: true });
    if (typeof id === "number") {
      try {
        chrome.downloads.show(id);
      } catch {
        /* ignore */
      }
    }
    return true;
  } catch {
    try {
      await chrome.tabs.create({ url });
      return true;
    } catch {
      return false;
    }
  }
}

async function waitForMotor(ms = 8 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const stored = await chrome.storage.local.get(["localUrl"]);
    const probe = await probeLocal(stored.localUrl);
    if (probe?.ok && probe.ready) return probe;
    await new Promise((r) => setTimeout(r, 2000));
    const elapsed = Date.now() - start;
    const percent = Math.min(90, 20 + Math.round((elapsed / ms) * 70));
    await chrome.storage.local.set({
      localProgress: {
        downloading: true,
        percent,
        label: "Esperando o instalador… abra VozClara-Motor-Setup em Downloads.",
        error: "",
      },
    });
    updateBadge({ downloading: true, percent });
  }
  return null;
}

async function beginNemotron() {
  const hint =
    "Baixei o instalador em Downloads. Dê dois cliques em VozClara-Motor-Setup. Se o Windows avisar, Mais informações → Executar assim mesmo.";
  await chrome.storage.local.set({
    provider: "local",
    preferredKind: "nemotron",
    localModelKind: "nemotron",
    localProgress: {
      downloading: true,
      percent: 8,
      label: "Procurando o motor no PC…",
      error: "",
    },
  });
  updateBadge({ downloading: true, percent: 8 });
  openProgressTab();
  try {
    const stored = await chrome.storage.local.get(["localUrl"]);
    let probe = await probeLocal(stored.localUrl);
    if (probe?.ok && probe.ready) {
      await chrome.storage.local.set({
        localModelReady: true,
        localModelId: probe.model || "nemotron-3.5-asr",
        localModelKind: "nemotron",
        localProgress: {
          downloading: false,
          percent: 100,
          label: `Pronto · ${probe.model || "Nemotron"} no PC`,
          error: "",
        },
      });
      updateBadge({ ready: true, downloading: false });
      return;
    }
    await chrome.storage.local.set({
      localProgress: {
        downloading: true,
        percent: 15,
        label: "Baixando o instalador do motor…",
        error: "",
      },
    });
    await downloadMotorZip();
    await chrome.storage.local.set({
      localProgress: {
        downloading: true,
        percent: 25,
        label: hint,
        error: "",
      },
    });
    probe = await waitForMotor();
    if (probe?.ok && probe.ready) {
      await chrome.storage.local.set({
        localModelReady: true,
        localModelId: probe.model || "nemotron-3.5-asr",
        localModelKind: "nemotron",
        localProgress: {
          downloading: false,
          percent: 100,
          label: `Pronto · ${probe.model || "Nemotron"} no PC`,
          error: "",
        },
      });
      updateBadge({ ready: true, downloading: false });
      return;
    }
    throw new Error(hint);
  } catch (err) {
    const error = err instanceof Error ? err.message : hint;
    await chrome.storage.local.set({
      localModelReady: false,
      localModelKind: "nemotron",
      localProgress: {
        downloading: false,
        percent: 0,
        error,
        label: error,
      },
    });
    updateBadge({ error });
  }
}

async function transcribeLocal(blob, name, language, url, probe) {
  const root = localRoot(url);
  const form = new FormData();
  form.append("file", new File([blob], name, { type: blob.type || "audio/ogg" }));
  if (language) form.append("language", language);
  const paths = ["/v1/audio/transcriptions", "/inference"];
  let last = "Motor local não respondeu.";
  let token = "";
  try {
    token = await motorToken();
  } catch {
    token = "";
  }
  for (const path of paths) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${root}${path}`, {
      method: "POST",
      headers,
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) {
      const text = asText(json);
      if (text) return text;
      last = "O Whisper local devolveu uma transcrição vazia.";
      continue;
    }
    if (res.status === 401 && json?.unpaired === true) {
      token = await pairMotor(url);
      continue;
    }
    last =
      (typeof json?.error === "string" && json.error) ||
      json?.error?.message ||
      `Motor local ${res.status}`;
  }
  throw new Error(last);
}

async function transcribe(msg, tabId) {
  const stored = await chrome.storage.local.get([
    "provider",
    "apiKey",
    "language",
    "localUrl",
    "localModelKind",
    "preferredKind",
  ]);
  const provider = stored.provider || "local";
  const apiKey = (stored.apiKey || "").trim();
  const language = stored.language === "auto" ? "" : stored.language || "pt";
  const kind = normalizeKind(stored.preferredKind || stored.localModelKind);

  if (provider !== "local" && !apiKey) {
    return {
      ok: false,
      error:
        "Cole uma chave de API no painel da VozClara, ou escolha Whisper neste Chrome.",
    };
  }

  const blob = audioBlobFromMsg(msg);
  const name = mimeToName(blob.type, msg.fileName || "voice.ogg");

  const cacheKey = `tx:${await hashBlob(blob)}:${provider}:${kind}:${language || "auto"}`;
  const cached = await chrome.storage.local.get(cacheKey);
  const cachedText = txText(cached[cacheKey]);
  if (cachedText && !msg.fresh) {
    const cleanedCache = collapseRepeats(cachedText);
    if (!isRepeatLoop(cachedText, cleanedCache)) {
      return { ok: true, text: cleanedCache, provider, cached: true };
    }
  }

  let text = "";
  let model = "";
  let device = "";
  if (provider === "local" && kind === "nemotron") {
    let probe = await probeLocal(stored.localUrl);
    if (!probe?.ok || !probe.ready) {
      const woke = await wakeMotor();
      probe = await probeLocal(stored.localUrl);
      if (!probe?.ok) {
        return {
          ok: false,
          error:
            woke?.error ||
            "Não alcanço o motor. O ícone da bandeja pode estar ligado sem responder. Clique em Ligar motor.",
        };
      }
      if (!probe.ready) {
        return {
          ok: false,
          error:
            probe.error ||
            "O motor está ligado, mas o Nemotron ainda carrega. Espere Pronto no painel e clique de novo.",
        };
      }
    }
    try {
      text = await transcribeLocal(blob, name, language, stored.localUrl, probe);
      model = probe?.model || "Nemotron";
      device = "motor";
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "O motor não transcreveu. Veja se o Nemotron terminou de carregar.",
      };
    }
  } else if (provider === "local") {
    try {
      const result = await transcribeInBrowser({ ...msg, language, kind }, tabId);
      if (result?.cancelled) return { ok: false, cancelled: true };
      text = result?.text || "";
      model = result?.model || "";
      device = result?.device || "";
    } catch (err) {
      try {
        const fallback = await probeLocal(stored.localUrl);
        text = await transcribeLocal(blob, name, language, stored.localUrl, fallback);
        model = fallback?.model || model;
        device = device || "motor";
      } catch {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Não deu para transcrever neste Chrome. Clique em Baixar Whisper no ícone da VozClara.",
        };
      }
    }
  } else if (provider === "openai") text = await transcribeOpenAI(blob, name, apiKey, language);
  else if (provider === "groq") text = await transcribeGroq(blob, name, apiKey, language);
  else if (provider === "gemini") text = await transcribeGemini(blob, apiKey, language);
  else text = await transcribeXai(blob, name, apiKey, language);

  // Parte 7.4: card cancelou — descarta o resultado (não promete abortar o fetch).
  if (msg.requestId && cancelledRequests.has(msg.requestId)) {
    cancelledRequests.delete(msg.requestId);
    return { ok: false, cancelled: true };
  }

  const rawText = text;
  text = collapseRepeats(text);
  const cleaned = isRepeatLoop(rawText, text);
  if (!cleaned) {
    try {
      await chrome.storage.local.set({ [cacheKey]: { t: Date.now(), text } });
    } catch {
      await pruneCache().catch(() => {});
      try {
        await chrome.storage.local.set({ [cacheKey]: { t: Date.now(), text } });
      } catch {
        /* segue sem cache — transcrição já está OK */
      }
    }
  } else {
    try {
      await chrome.storage.local.remove(cacheKey);
    } catch {
      /* ignore */
    }
  }
  return { ok: true, text, provider, model, device, cleaned };
}

const TX_PREFIX = "tx:";
const TX_KEEP = 200;

function collapseRepeats(text) {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length < 40) return s;
  const words = s.split(" ");
  for (let len = 16; len >= 2; len--) {
    const out = [];
    let i = 0;
    while (i < words.length) {
      if (i + len * 3 <= words.length) {
        const chunk = words.slice(i, i + len);
        const key = chunk.join(" ").toLowerCase();
        let reps = 1;
        while (
          i + len * (reps + 1) <= words.length &&
          words
            .slice(i + len * reps, i + len * (reps + 1))
            .join(" ")
            .toLowerCase() === key
        ) {
          reps += 1;
        }
        if (reps >= 3) {
          out.push(...chunk);
          i += len * reps;
          continue;
        }
      }
      out.push(words[i]);
      i += 1;
    }
    words.splice(0, words.length, ...out);
  }
  return words.join(" ").replace(/\s+,/g, ",").replace(/,\s*,+/g, ",").trim();
}

function isRepeatLoop(original, cleaned) {
  const raw = String(original || "");
  const out = String(cleaned || "");
  return raw.length > 80 && out.length * 2.5 < raw.length;
}

function txText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.text === "string") return value.text;
  return "";
}

function txTime(value) {
  if (value && typeof value.t === "number") return value.t;
  return 0;
}

async function pruneCache() {
  const all = await chrome.storage.local.get(null);
  const entries = Object.keys(all)
    .filter((k) => k.startsWith(TX_PREFIX))
    .map((k) => ({ k, ts: txTime(all[k]) }));
  entries.sort((a, b) => b.ts - a.ts);
  const excess = entries.slice(TX_KEEP).map((e) => e.k);
  if (excess.length) await chrome.storage.local.remove(excess);
}
