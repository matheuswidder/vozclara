const MENU_ID = "vozclara-transcribe";
const MOTOR_SETUP_HINT =
  "Na primeira vez, rode engine/VozClara-Motor-Setup.exe do zip. Depois use Ligar o motor — o Setup só abre o que já está no PC, sem instalar de novo.";

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
          error: err instanceof Error ? err.message : "Não baixei o Qwen.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_GEMMA_DELETE") {
    deleteGemmaMotor()
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Não apaguei o Qwen.",
        }),
      );
    return true;
  }
  if (msg?.type === "VOZCLARA_SUGGEST") {
    suggestReplies(msg.text, {
      context: msg.context,
      tone: msg.tone,
      outgoing: msg.outgoing,
    })
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
    "motorAlive",
    "motorUp",
    "motorInstalled",
  ]);
  const alive = Boolean(stored.motorAlive);
  const up = Boolean(stored.motorUp);
  return {
    ok: true,
    ready: Boolean(stored.localModelReady) || up,
    downloading: Boolean(stored.localProgress?.downloading),
    percent: stored.localProgress?.percent || (stored.localModelReady || up ? 100 : 0),
    label: stored.localProgress?.label,
    error: stored.localProgress?.error,
    model: stored.localModelId,
    kind: stored.preferredKind || stored.localModelKind,
    device: stored.localModelDevice,
    customRepo: stored.customModelRepo || stored.customModelInput || "",
    cachedKinds: Array.isArray(stored.cachedKinds) ? stored.cachedKinds : [],
    motorAlive: alive,
    motorUp: up,
    motorInstalled: Boolean(stored.motorInstalled) || alive || up,
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
    const up = alive;
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

async function persistMotorFlags(flags) {
  const alive = Boolean(flags.alive);
  const up = Boolean(flags.up);
  const installed = Boolean(flags.installed) || alive || up;
  await chrome.storage.local.set({
    motorAlive: alive,
    motorUp: up,
    motorInstalled: installed,
  });
}

async function verifyModel(opts = {}) {
  const stored = await storedStatus();
  const kind = normalizeKind(opts.kind || stored.kind);
  if (opts.kind && kind !== normalizeKind(stored.kind)) {
    await chrome.storage.local.set({ preferredKind: kind });
  }
  if (kind === "nemotron") {
    const extra = await chrome.storage.local.get(["localUrl", "motorInstalled"]);
    const probe = await probeLocal(extra.localUrl);
    const alive = Boolean(probe?.ok);
    const up = Boolean(probe?.ok && probe.ready);
    const installed = Boolean(extra.motorInstalled) || alive || up;
    await persistMotorFlags({ alive, up, installed });
    await chrome.storage.local.set({
      localModelReady: up,
      motorInstalled: installed,
      localProgress: {
        downloading: false,
        percent: up ? 100 : Number(probe?.percent) || 0,
        error: up ? "" : alive ? probe?.error || "" : installed ? "Não alcanço o motor neste PC." : "",
        label: up
          ? `Pronto · ${probe.model || "Nemotron"} na bandeja`
          : alive
            ? probe?.detail || "Motor ligado. O modelo sobe na primeira transcrição."
            : installed
              ? "Não alcanço o motor. Clique em Ligar o motor."
              : MOTOR_SETUP_HINT,
      },
    });
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
      motorInstalled: installed,
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
            : installed
            ? "Não alcanço o motor. Clique em Ligar o motor."
            : MOTOR_SETUP_HINT,
      error: up ? "" : alive ? probe?.error || "" : installed ? "Não alcanço o motor neste PC." : "",
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
  const extra = await chrome.storage.local.get([
    "localUrl",
    "gemmaKind",
    "gemmaOn",
    "gemmaWaitingMotor",
    "gemmaError",
    "gemmaSetupOk",
    "gemmaSawLoading",
    "gemmaLoadStartedAt",
  ]);
  let probe = { ok: false };
  const needMotor =
    extra.gemmaOn || extra.gemmaWaitingMotor || status.motorAlive;
  if (needMotor) {
    try {
      probe = await probeLocal(extra.localUrl);
    } catch {
      probe = { ok: false };
    }
  }
  const g =
    (probe?.suggest && typeof probe.suggest === "object" && probe.suggest) ||
    (probe?.gemma && typeof probe.gemma === "object" && probe.gemma) ||
    {};
  const stale = Boolean(probe?.ok) && probe.suggest == null && probe.gemma == null;
  if (extra.gemmaWaitingMotor && (probe.suggest != null || probe.gemma != null)) {
    await chrome.storage.local.set({
      gemmaWaitingMotor: false,
      gemmaStale: false,
      gemmaLoading: true,
    });
    postGemmaLoad("qwen").catch(() => {});
  }
  const sawLoading = Boolean(extra.gemmaSawLoading) || Boolean(g.loading);
  const startedAt = Number(extra.gemmaLoadStartedAt) || 0;
  const waited = startedAt > 0 && Date.now() - startedAt > 45000;
  let crash = "";
  if (
    extra.gemmaSawLoading &&
    waited &&
    probe?.ok &&
    !g.loading &&
    !g.ready &&
    !g.error &&
    !stale
  ) {
    crash =
      "O motor parou no meio do download. Feche outros programas e clique em Tentar de novo.";
  }
  const prevErr = String(extra.gemmaError || "").trim();
  const motorOffErr = /ligue o motor na bandeja/i.test(prevErr);
  const keepErr = g.ready || g.loading
    ? ""
    : String(g.error || crash || (probe?.ok && motorOffErr ? "" : prevErr) || "").trim();
  const alive = needMotor ? Boolean(probe?.ok) : Boolean(status.motorAlive);
  const up = needMotor ? Boolean(probe?.ok && probe.ready) : Boolean(status.motorUp);
  if (needMotor) {
    await persistMotorFlags({
      alive,
      up,
      installed: Boolean(status.motorInstalled) || alive || up,
    });
  }
  await chrome.storage.local.set({
    gemmaReady: Boolean(g.ready),
    gemmaLoading: Boolean(g.loading) || Boolean(extra.gemmaWaitingMotor && stale),
    gemmaError: keepErr,
    gemmaStale: stale,
    gemmaSawLoading: Boolean(g.loading) || (Boolean(extra.gemmaSawLoading) && !g.ready && !keepErr),
    gemmaLoadStartedAt: g.ready ? 0 : extra.gemmaLoadStartedAt || 0,
    gemmaPercent: Number(g.percent) || 0,
    gemmaDetail: g.detail || "",
    gemmaCached: Boolean(g.cached),
    gemmaBytes: Number(g.bytes) || 0,
  });
  if (g.ready) stopGemmaWatch(true);
  else if (g.loading || extra.gemmaLoading) startGemmaWatch();
  return {
    ...status,
    motorAlive: alive,
    motorUp: up,
    gemmaStale: stale,
    gemmaWaiting: Boolean(extra.gemmaWaitingMotor) && stale,
    gemmaSetupOk: Boolean(extra.gemmaSetupOk),
    gemmaPending: Boolean(g.loading) || (sawLoading && !g.ready && !keepErr),
    gemma: {
      ready: Boolean(g.ready),
      loading: Boolean(g.loading),
      kind: g.kind || extra.gemmaKind || "qwen",
      percent: Number(g.percent) || 0,
      detail: g.detail || "",
      error: keepErr,
      stale,
      cached: Boolean(g.cached),
      bytes: Number(g.bytes) || 0,
    },
  };
}

async function postGemmaLoad(kind) {
  const want = "qwen";
  const extra = await chrome.storage.local.get(["localUrl"]);
  const root = localRoot(extra.localUrl) || "http://127.0.0.1:8173";
  let token = "";
  try {
    token = await motorToken();
  } catch {
    token = "";
  }
  const send = (path) =>
    fetch(`${root}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind: want }),
    });
  let res = await send("/v1/suggest/load");
  if (res.status === 404) res = await send("/v1/gemma/load");
  let json = await res.json().catch(() => null);
  if (res.status === 401 && json?.unpaired === true) {
    try {
      token = await pairMotor(extra.localUrl);
    } catch {
      token = "";
    }
    res = await send("/v1/suggest/load");
    if (res.status === 404) res = await send("/v1/gemma/load");
    json = await res.json().catch(() => null);
  }
  if (res.status === 404) {
    return { ok: false, missing: true };
  }
  if (!res.ok) {
    throw new Error(
      (typeof json?.error === "string" && json.error) || "Não comecei o download do Qwen.",
    );
  }
  return { ok: true, started: true, ready: Boolean(json?.ready), kind: want };
}

let gemmaWatch = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startGemmaWatch() {
  if (gemmaWatch) return;
  gemmaWatch = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
    void tickGemmaWatch();
  }, 800);
  void tickGemmaWatch();
}

function stopGemmaWatch(ready) {
  if (gemmaWatch) {
    clearInterval(gemmaWatch);
    gemmaWatch = null;
  }
  chrome.storage.local.get(["localProgress"]).then((stored) => {
    if (stored.localProgress?.downloading) return;
    try {
      if (ready) {
        chrome.action.setBadgeBackgroundColor({ color: "#5dcaa0" });
        chrome.action.setBadgeText({ text: "OK" });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
      }
    } catch {
      /* ignore */
    }
  });
}

async function tickGemmaWatch() {
  try {
    const extra = await chrome.storage.local.get(["localUrl", "gemmaLoading", "localProgress"]);
    const probe = await probeLocal(extra.localUrl);
    const g = probe?.suggest || probe?.gemma || {};
    await chrome.storage.local.set({
      gemmaReady: Boolean(g.ready),
      gemmaLoading: Boolean(g.loading),
      gemmaPercent: Number(g.percent) || 0,
      gemmaDetail: g.detail || "",
      gemmaError: g.error || "",
      gemmaCached: Boolean(g.cached),
      gemmaBytes: Number(g.bytes) || 0,
    });
    if (!extra.localProgress?.downloading) {
      try {
        if (g.loading) {
          chrome.action.setBadgeBackgroundColor({ color: "#5dcaa0" });
          chrome.action.setBadgeText({
            text: String(Math.max(1, Math.min(99, Number(g.percent) || 1))),
          });
        }
      } catch {
        /* ignore */
      }
    }
    if (!g.loading) stopGemmaWatch(Boolean(g.ready));
  } catch {
    /* keep ticking */
  }
}

async function postGemmaDelete() {
  const extra = await chrome.storage.local.get(["localUrl"]);
  const root = localRoot(extra.localUrl) || "http://127.0.0.1:8173";
  let token = "";
  try {
    token = await motorToken();
  } catch {
    token = "";
  }
  const send = (path) =>
    fetch(`${root}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
  let res = await send("/v1/suggest/delete");
  if (res.status === 404) res = await send("/v1/gemma/delete");
  let json = await res.json().catch(() => null);
  if (res.status === 401 && json?.unpaired === true) {
    try {
      token = await pairMotor(extra.localUrl);
    } catch {
      token = "";
    }
    res = await send("/v1/suggest/delete");
    if (res.status === 404) res = await send("/v1/gemma/delete");
    json = await res.json().catch(() => null);
  }
  if (res.status === 404) {
    return { ok: false, missing: true };
  }
  if (!res.ok) {
    throw new Error(
      (typeof json?.error === "string" && json.error) || "Não apaguei o Qwen.",
    );
  }
  return { ok: true, deleted: true };
}

async function deleteGemmaMotor() {
  stopGemmaWatch(false);
  try {
    const extra = await chrome.storage.local.get(["localUrl"]);
    let probe = await probeLocal(extra.localUrl);
    if (!probe?.ok) {
      throw new Error("Ligue o motor na bandeja para apagar o modelo.");
    }
    const posted = await postGemmaDelete();
    if (posted.missing) {
      throw new Error(
        "Este motor ainda não sabe apagar o Qwen. Feche a bandeja (Sair) e rode o Setup de novo.",
      );
    }
    await chrome.storage.local.set({
      gemmaReady: false,
      gemmaLoading: false,
      gemmaError: "",
      gemmaPercent: 0,
      gemmaDetail: "Modelo apagado",
      gemmaCached: false,
      gemmaBytes: 0,
      gemmaSawLoading: false,
      gemmaLoadStartedAt: 0,
    });
    try {
      chrome.action.setBadgeText({ text: "" });
    } catch {
      /* ignore */
    }
    return posted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não apaguei o Qwen.";
    await chrome.storage.local.set({ gemmaError: msg });
    throw err;
  }
}

async function loadGemmaMotor(kind) {
  const want = "qwen";
  await chrome.storage.local.set({ gemmaOn: true, gemmaKind: want, gemmaLoading: true });
  try {
    const extra = await chrome.storage.local.get(["localUrl", "gemmaSetupAt"]);
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
      throw new Error("Ligue o motor na bandeja.");
    }
    if (probe.suggest == null && probe.gemma == null) {
      const error =
        "Este motor ainda não sabe sugerir respostas. Feche o ícone da bandeja (Sair) e abra o Setup — se já instalou, ele só atualiza e liga.";
      await chrome.storage.local.set({
        gemmaSetupOk: true,
        gemmaError: error,
        gemmaWaitingMotor: true,
        gemmaStale: true,
        gemmaLoading: false,
      });
      throw new Error(error);
    }
    const posted = await postGemmaLoad(want);
    if (posted.missing) {
      const error =
        "Este motor ainda não sabe sugerir respostas. Feche o ícone da bandeja (Sair) e abra o Setup — se já instalou, ele só atualiza e liga.";
      await chrome.storage.local.set({
        gemmaWaitingMotor: true,
        gemmaStale: true,
        gemmaLoading: false,
        gemmaError: error,
        gemmaSawLoading: false,
      });
      return { ok: false, waiting: true, error };
    }
    await chrome.storage.local.set({
      gemmaSawLoading: false,
      gemmaLoading: true,
      gemmaError: "",
      gemmaLoadStartedAt: Date.now(),
    });
    startGemmaWatch();
    return posted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não baixei o Qwen.";
    await chrome.storage.local.set({
      gemmaLoading: false,
      gemmaError: msg,
      gemmaSawLoading: false,
    });
    throw err;
  }
}

async function suggestReplies(text, opts = {}) {
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
    return { ok: false, error: "Ligue o motor na bandeja para sugerir." };
  }
  const llm = probe.suggest || probe.gemma;
  if (!llm?.ready) {
    try {
      await loadGemmaMotor("qwen");
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Baixe o Qwen no painel.",
      };
    }
    const deadline = Date.now() + 45 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(900);
      const again = await probeLocal(stored.localUrl);
      const g = again?.suggest || again?.gemma || {};
      if (g.ready) break;
      if (g.error && !g.loading) {
        return { ok: false, error: String(g.error) };
      }
    }
    const last = await probeLocal(stored.localUrl);
    const ready = Boolean((last?.suggest || last?.gemma || {}).ready);
    if (!ready) {
      return {
        ok: false,
        error: "O Qwen ainda está baixando. Deixe o painel aberto — a barra mostra o progresso.",
      };
    }
  }
  const root = localRoot(stored.localUrl) || "http://127.0.0.1:8173";
  let token = "";
  try {
    token = await motorToken();
  } catch {
    token = "";
  }
  const body = JSON.stringify({
    text: raw,
    kind: "qwen",
    who: stored.gemmaWho || "",
    tone: opts.tone || stored.gemmaTone || "cliente",
    notes: stored.gemmaNotes || "",
    context: String(opts.context || "").trim(),
    outgoing: Boolean(opts.outgoing),
  });
  const sendSuggest = () =>
    fetch(`${root}/v1/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
  let res = await sendSuggest();
  let json = await res.json().catch(() => null);
  if (res.status === 401 && json?.unpaired === true) {
    try {
      token = await pairMotor(stored.localUrl);
    } catch {
      token = "";
    }
    res = await sendSuggest();
    json = await res.json().catch(() => null);
  }
  if (res.status === 404) {
    return { ok: false, error: "Motor antigo. A transcrição segue; para sugerir respostas, rode de novo o instalador." };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: (typeof json?.error === "string" && json.error) || "O Qwen não sugeriu.",
    };
  }
  const replies = Array.isArray(json?.replies)
    ? json.replies.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  if (!replies.length) {
    return { ok: false, error: "O Qwen não devolveu respostas." };
  }
  return { ok: true, replies, kind: json?.kind || "qwen" };
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
          suggest: json?.suggest || json?.gemma || null,
          gemma: json?.suggest || json?.gemma || null,
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
        error:
          "Não alcanço o motor. Se já instalou, clique em Ligar o motor ou no atalho VozClara Motor da área de trabalho.",
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
      "Não alcanço o motor. Se já instalou, clique em Ligar o motor ou no atalho VozClara Motor da área de trabalho.",
  };
}

async function findExistingSetup() {
  if (!chrome.downloads?.search) return null;
  try {
    const items = await chrome.downloads.search({
      filenameRegex: "VozClara-Motor-Setup",
      exists: true,
      limit: 20,
      orderBy: ["-startTime"],
    });
    return (
      items.find(
        (row) =>
          row.state === "complete" &&
          row.exists !== false &&
          /VozClara-Motor-Setup/i.test(row.filename || ""),
      ) || null
    );
  } catch {
    return null;
  }
}

async function showSetup(id) {
  if (typeof id !== "number") return;
  try {
    chrome.downloads.show(id);
  } catch {
    /* ignore */
  }
}

async function offerSetup() {
  const existing = await findExistingSetup();
  if (existing) {
    await showSetup(existing.id);
    return { ok: true, reused: true };
  }
  return { ok: false, reused: false };
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
        label: "Esperando o motor na bandeja… rode o Setup do zip se ainda não rodou.",
        error: "",
      },
    });
    updateBadge({ downloading: true, percent });
  }
  return null;
}

async function beginNemotron() {
  await chrome.storage.local.set({
    provider: "local",
    preferredKind: "nemotron",
    localModelKind: "nemotron",
    localProgress: {
      downloading: true,
      percent: 8,
      label: "Procurando o motor neste PC…",
      error: "",
    },
  });
  updateBadge({ downloading: true, percent: 8 });
  try {
    const stored = await chrome.storage.local.get(["localUrl"]);
    let probe = await probeLocal(stored.localUrl);
    if (probe?.ok && probe.ready) {
      await chrome.storage.local.set({
        localModelReady: true,
        localModelId: probe.model || "nemotron-3.5-asr",
        localModelKind: "nemotron",
        motorInstalled: true,
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
    if (probe?.ok && !probe.ready) {
      await chrome.storage.local.set({
        motorInstalled: true,
        localProgress: {
          downloading: true,
          percent: Number(probe.percent) || 20,
          label: probe.detail || "Motor ligado. Carregando o modelo…",
          error: "",
        },
      });
      probe = await waitForMotor();
      if (probe?.ok && probe.ready) {
        await chrome.storage.local.set({
          localModelReady: true,
          localModelId: probe.model || "nemotron-3.5-asr",
          localModelKind: "nemotron",
          motorInstalled: true,
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
      throw new Error(MOTOR_SETUP_HINT);
    }
    const extra = await chrome.storage.local.get(["motorInstalled"]);
    if (extra.motorInstalled) {
      const woken = await wakeMotor();
      if (woken?.ok) return;
      const error =
        "O motor já está neste PC, mas desligado. Use Ligar o motor ou o atalho VozClara Motor na área de trabalho.";
      await chrome.storage.local.set({
        localProgress: {
          downloading: false,
          percent: 0,
          label: error,
          error,
        },
      });
      updateBadge({ error });
      return;
    }
    const offered = await offerSetup();
    const label = offered.reused
      ? "Setup já estava em Downloads. Se o motor já foi instalado, o Setup só liga — sem baixar de novo."
      : MOTOR_SETUP_HINT;
    await chrome.storage.local.set({
      localProgress: {
        downloading: false,
        percent: 0,
        label,
        error: label,
      },
    });
    updateBadge({ error: label });
  } catch (err) {
    const error = err instanceof Error ? err.message : MOTOR_SETUP_HINT;
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
    const cleanedCache = tidyTranscript(cachedText, language);
    if (cleanedCache && !isRepeatLoop(cachedText, collapseRepeats(cachedText))) {
      return {
        ok: true,
        text: cleanedCache,
        provider,
        cached: true,
        langCleaned: isLangCleaned(cachedText, cleanedCache),
      };
    }
  }

  let text = "";
  let model = "";
  let device = "";
    if (provider === "local" && kind === "nemotron") {
    let probe = await probeLocal(stored.localUrl);
    if (!probe?.ok) {
      const woke = await wakeMotor();
      probe = await probeLocal(stored.localUrl);
      if (!probe?.ok) {
        return {
          ok: false,
          error:
            woke?.error ||
            "Não alcanço o motor. Se a bandeja estiver desligada, rode o Setup do zip e clique em Verificar.",
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
  return { ok: true, text, provider, model, device, cleaned, langCleaned };
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
