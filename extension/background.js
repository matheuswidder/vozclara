importScripts("shared.js");

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
    verifyModel({ kind: msg.kind })
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, ready: false, checked: false }));
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
        new Error("O Whisper reiniciou. Clique de novo em Baixar Whisper."),
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
    return "O Whisper neste Chrome falhou ao iniciar. Recarregue a extensão e clique de novo em Baixar Whisper.";
  }
  if (/message port closed/i.test(raw)) {
    return "O painel do ícone fechou. O download segue na aba da VozClara.";
  }
  if (/Failed to fetch|NetworkError|NETWORK|CORS|blocked/i.test(raw)) {
    return "O Brave bloqueou o download. Nos Escudos, libere huggingface.co para esta extensão.";
  }
  if (/quota|QuotaExceeded/i.test(raw)) {
    return "Sem espaço neste navegador para o modelo. Tente o Large Turbo.";
  }
  if (/single offscreen|Only a single/i.test(raw)) {
    return "O Whisper já está ligando. Espere um instante e veja a aba da VozClara.";
  }
  if (/createObjectURL is not a function/i.test(raw)) {
    return "Não deu para abrir o Explorer. Recarregue a extensão e tente de novo.";
  }
  if (/Unable to decode audio data|decode audio|Não li este Opus|OGG sem pacotes|AudioDecoder/i.test(raw)) {
    return "Não li o Opus deste áudio. Recarregue a extensão (versão nova) e clique de novo em Transcrever.";
  }
  if (/Failed to resolve module|Cannot find module|onnxruntime/i.test(raw)) {
    return "Falta o Whisper neste zip. Baixe o pacote de novo e recarregue a extensão.";
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
    return Promise.reject(new Error("Whisper desligado. Baixe o Large Turbo no ícone da extensão."));
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
  large: {
    repo: "onnx-community/whisper-large-v3",
    label: "large-v3",
  },
};

// SYNC: shared.js — cópia quente (SW clássico não importa módulos); o teste
// extension/tests/shared-sync.test.mjs falha se divergir.
function normalizeKind(kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "large" || k === "v3" || k === "large-v3") return "large";
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
  if (want === "custom") return;
  const stored = await chrome.storage.local.get(["cachedKinds"]);
  const list = Array.isArray(stored.cachedKinds) ? stored.cachedKinds.slice() : [];
  if (!list.includes(want)) list.push(want);
  await chrome.storage.local.set({ cachedKinds: list });
}

async function scanKnownKinds() {
  const kinds = ["turbo", "large"];
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
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      chrome.downloads.onChanged.removeListener(onChange);
      clearTimeout(timer);
      resolve(ok);
    };
    const onChange = (delta) => {
      if (delta.id !== id) return;
      const state = delta.state?.current;
      if (state === "complete") finish(true);
      if (state === "interrupted") finish(false);
    };
    const timer = setTimeout(() => finish(false), 2 * 60 * 1000);
    chrome.downloads.onChanged.addListener(onChange);
    chrome.downloads.search({ id }).then((items) => {
      const state = items[0]?.state;
      if (state === "complete") finish(true);
      if (state === "interrupted") finish(false);
    }).catch(() => {});
  });
}

async function verifyModel(opts = {}) {
  const stored = await storedStatus();
  const kind = normalizeKind(opts.kind || stored.kind);
  if (opts.kind && kind !== normalizeKind(stored.kind)) {
    await chrome.storage.local.set({ preferredKind: kind });
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
  return {
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
  };
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
  const parsed = parseHfRepo(repo || "");
  const disk = await scanModelCache(want, parsed);
  const switching = Boolean(disk.ready);
  const label = switching
    ? `Trocando para ${disk.model}…`
    : want === "custom"
      ? `Baixando ${parsed || "modelo"}…`
      : `Baixando ${disk.model}…`;
  await chrome.storage.local.set({
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

async function hashBlob(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function transcribe(msg, tabId) {
  const stored = await chrome.storage.local.get([
    "language",
    "localModelKind",
    "preferredKind",
  ]);
  const language = stored.language === "auto" ? "" : stored.language || "pt";
  const kind = normalizeKind(stored.preferredKind || stored.localModelKind);

  const blob = audioBlobFromMsg(msg);

  const cacheKey = `tx:${await hashBlob(blob)}:${kind}:${language || "auto"}`;
  const cached = await chrome.storage.local.get(cacheKey);
  const cachedText = txText(cached[cacheKey]);
  if (cachedText && !msg.fresh) {
    const cleanedCache = tidyTranscript(cachedText, language);
    if (cleanedCache && !isRepeatLoop(cachedText, collapseRepeats(cachedText))) {
      return {
        ok: true,
        text: cleanedCache,
        cached: true,
        langCleaned: isLangCleaned(cachedText, cleanedCache),
      };
    }
  }

  let text = "";
  let model = "";
  let device = "";
  try {
    const result = await transcribeInBrowser({ ...msg, language, kind }, tabId);
    if (result?.cancelled) return { ok: false, cancelled: true };
    text = result?.text || "";
    model = result?.model || "";
    device = result?.device || "";
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Não deu para transcrever neste Chrome. Baixe o Large Turbo no ícone da extensão.",
    };
  }

  // Parte 7.4: card cancelou — descarta o resultado (não promete abortar o fetch).
  if (msg.requestId && cancelledRequests.has(msg.requestId)) {
    cancelledRequests.delete(msg.requestId);
    return { ok: false, cancelled: true };
  }

  const rawText = text;
  text = tidyTranscript(text, language);
  const cleaned = isRepeatLoop(rawText, collapseRepeats(rawText));
  const langCleaned = isLangCleaned(rawText, text);
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
  return { ok: true, text, model, device, cleaned, langCleaned };
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

function latinLetterShare(text) {
  const letters = [...String(text || "")].filter((ch) => /\p{Letter}/u.test(ch));
  if (!letters.length) return 1;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return latin / letters.length;
}

function keepLatinTranscript(text) {
  let out = String(text || "").replace(
    /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Symbol}\s]/gu,
    " ",
  );
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\s+([,.!?;:])/g, "$1");
  out = out.replace(/(?:^|\s)['"`´]+(?=\s|$)/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

function filterTranscriptByLang(text, lang) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const code = String(lang || "pt").toLowerCase();
  const latinLang = code === "pt" || code === "en" || code === "es" || code === "pt-br";
  if (code === "auto") {
    if (latinLetterShare(raw) >= 0.55) return keepLatinTranscript(raw);
    return raw;
  }
  if (latinLang) return keepLatinTranscript(raw);
  return raw;
}

function isLangCleaned(original, cleaned) {
  const raw = String(original || "");
  const out = String(cleaned || "");
  if (!raw || raw === out) return false;
  return /[^\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Symbol}\s]/u.test(raw);
}

function tidyTranscript(text, language) {
  return filterTranscriptByLang(collapseRepeats(text), language);
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
