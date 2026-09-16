const MODELS = {
  turbo: {
    repo: "onnx-community/whisper-large-v3-turbo",
    label: "large-v3-turbo",
    sizeLabel: "~560 MB",
  },
  v3: {
    repo: "onnx-community/whisper-large-v3",
    label: "large-v3",
    sizeLabel: "~1,5 GB",
  },
  light: {
    repo: "onnx-community/whisper-small",
    label: "whisper-small",
    sizeLabel: "~120 MB",
  },
  tiny: {
    repo: "onnx-community/whisper-tiny",
    label: "whisper-tiny",
    sizeLabel: "~40 MB",
  },
};

// SYNC: shared.js — cópia quente; o teste extension/tests/shared-sync.test.mjs
// falha se divergir.
function normalizeKind(kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "light" || k === "small") return "light";
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

function asrBlockReason(repo) {
  const id = String(repo || "");
  if (/nemotron|parakeet|fastconformer|canary|nemo[-_]?asr/i.test(id)) {
    return "O Nemotron da NVIDIA não roda neste Chrome. Ele é FastConformer + RNNT (NeMo), não Whisper. Use tiny, turbo ou um Whisper ONNX (onnx-community/whisper-tiny).";
  }
  return "";
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

/** @type {null | { pipe: any; kind: string; label: string; device: string }} */
let loaded = null;
let loading = null;
let hf = null;
let port = null;
const fileProgress = new Map();

function emit(partial) {
  const msg = {
    type: "VOZCLARA_MODEL_PROGRESS",
    ready: Boolean(loaded),
    downloading: Boolean(loading) && !loaded,
    model: loaded?.label || partial.model,
    device: loaded?.device || partial.device,
    kind: loaded?.kind || partial.kind,
    percent: 0,
    label: "",
    error: "",
    ...partial,
  };
  try {
    port?.postMessage(msg);
  } catch {
    /* o service worker grava o progresso */
  }
}

function persistLocalModelDevice(device) {
  if (!device) return;
  try {
    const p = chrome.storage?.local?.set({ localModelDevice: device });
    p?.catch?.(() => {});
  } catch {
    /* o service worker grava via persistProgress */
  }
}

function onHfProgress(data) {
  if (!data || typeof data !== "object") return;
  if (data.status === "progress" && data.file) {
    fileProgress.set(data.file, {
      loaded: Number(data.loaded) || 0,
      total: Number(data.total) || 0,
    });
    let loadedBytes = 0;
    let totalBytes = 0;
    for (const v of fileProgress.values()) {
      loadedBytes += v.loaded;
      totalBytes += v.total;
    }
    const percent = totalBytes
      ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100))
      : 0;
    emit({
      downloading: true,
      ready: false,
      percent,
      label: `Baixando Whisper… ${percent}%`,
    });
    return;
  }
  if (data.status === "ready" || data.status === "initiate") {
    emit({
      downloading: true,
      ready: false,
      percent: data.status === "ready" ? 99 : 1,
      label:
        data.status === "ready"
          ? "Preparando o modelo…"
          : "Começando o download…",
    });
  }
}

async function loadHf() {
  if (hf) return hf;
  emit({
    downloading: true,
    ready: false,
    percent: 1,
    label: "Ligando o motor…",
  });
  const mod = await import("./vendor/transformers.js");
  mod.env.allowLocalModels = false;
  mod.env.allowRemoteModels = true;
  mod.env.useBrowserCache = true;
  mod.env.useFS = false;
  mod.env.useFSCache = false;
  const wasmDir = chrome.runtime.getURL("vendor/");
  const wasm = mod.env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1;
    wasm.proxy = false;
    wasm.wasmPaths = wasmDir;
  }
  hf = mod;
  return hf;
}

/** @type {null | boolean} */
let webgpuCache = null;

async function hasWebGPU() {
  if (webgpuCache !== null) return webgpuCache;
  try {
    if (!self.navigator?.gpu) {
      webgpuCache = false;
      return false;
    }
    const adapter = await self.navigator.gpu.requestAdapter();
    if (!adapter) {
      webgpuCache = false;
      return false;
    }
    // limite conservador: GPU integrada atende; offscreen herda o mesmo adapter
    webgpuCache = (adapter.features?.size || 0) > 0;
    return webgpuCache;
  } catch {
    webgpuCache = false;
    return false;
  }
}

function attempts(webgpu) {
  if (webgpu) {
    return [
      { device: "webgpu", dtype: "q4f16" },
      { device: "webgpu", dtype: "q4" },
      { device: "wasm", dtype: "q4" },
    ];
  }
  return [
    { device: "wasm", dtype: "q4" },
    { device: "wasm", dtype: "q8" },
  ];
}

async function loadKind(kind, repoOverride) {
  const want = normalizeKind(kind);
  if (want === "nemotron") {
    throw new Error(
      "O Nemotron da NVIDIA não cabe neste Chrome. Rode vozclara-local/start-nemotron (bat ou command) e transcreva de novo.",
    );
  }
  let spec = MODELS[want];
  let repos = spec ? [spec.repo] : [];
  if (want === "custom" || repoOverride) {
    const parsed = parseHfRepo(repoOverride || spec?.repo || "");
    if (!parsed) {
      throw new Error(
        "Cole um link do Hugging Face, tipo https://huggingface.co/openai/whisper-tiny",
      );
    }
    const blocked = asrBlockReason(parsed);
    if (blocked) throw new Error(blocked);
    if (!/whisper/i.test(parsed)) {
      throw new Error(
        "Neste Chrome só Whisper ONNX. O Nemotron e outros modelos NeMo precisam de Python/GPU, não da extensão.",
      );
    }
    spec = { repo: parsed, label: parsed.split("/")[1] || parsed, sizeLabel: "" };
    repos = candidateRepos(parsed);
  }
  const { pipeline } = await loadHf();
  const webgpu = await hasWebGPU();
  let lastErr = new Error("Não consegui carregar o Whisper.");
  for (const repo of repos) {
    for (const a of attempts(webgpu)) {
      try {
        emit({
          downloading: true,
          ready: false,
          kind: want,
          model: spec.label,
          device: a.device,
          percent: fileProgress.size ? 50 : 2,
          label: `Carregando ${repo}…`,
        });
        const pipe = await pipeline("automatic-speech-recognition", repo, {
          device: a.device,
          dtype: a.dtype,
          progress_callback: onHfProgress,
        });
        const label = repo.split("/")[1] || spec.label;
        loaded = { pipe, kind: want, label, device: a.device, repo };
        persistLocalModelDevice(a.device);
        emit({
          downloading: false,
          ready: true,
          percent: 100,
          kind: want,
          model: label,
          device: a.device,
          label: `Pronto · ${label}`,
        });
        return loaded;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  throw new Error(
    lastErr.message?.includes("Whisper")
      ? lastErr.message
      : "Esse repositório não tem Whisper ONNX para o Chrome. Tente onnx-community/whisper-tiny.",
  );
}

async function ensureModel(kind, repo) {
  const want = normalizeKind(kind);
  const parsed = parseHfRepo(repo || "");
  if (
    loaded &&
    loaded.kind === want &&
    (want !== "custom" || loaded.repo === parsed || candidateRepos(parsed).includes(loaded.repo))
  ) {
    return loaded;
  }
  if (loading) {
    try {
      await loading;
    } catch {
      /* o download anterior falhou */
    }
    if (
      loaded &&
      loaded.kind === want &&
      (want !== "custom" || loaded.repo === parsed || candidateRepos(parsed).includes(loaded.repo))
    ) {
      return loaded;
    }
  }
  fileProgress.clear();
  loading = (async () => {
    try {
      try {
        return await loadKind(want, parsed);
      } catch (err) {
        if (want === "turbo") {
          // Parte 7.2: fallback turbo→leve avisado durante E depois do download.
          emit({
            downloading: true,
            ready: false,
            percent: 1,
            label: "O modelo grande não coube. Baixando a versão leve…",
            error: "",
          });
          const light = await loadKind("light");
          try {
            await chrome.storage.local.set({
              lastQualityFallback: {
                label: "O modelo grande não coube. Está em uso a versão leve (whisper-small).",
                at: Date.now(),
              },
            });
          } catch {
            /* popup/dock também avisam via persistProgress */
          }
          emit({
            downloading: false,
            ready: true,
            percent: 100,
            warning: true,
            label: `Pronto (versão leve) · ${light.label}`,
            model: light.label,
            device: light.device,
            kind: light.kind,
          });
          return light;
        }
        throw err;
      }
    } catch (err) {
      loaded = null;
      const message =
        err instanceof Error ? err.message : "Falha ao baixar o Whisper.";
      emit({
        downloading: false,
        ready: false,
        percent: 0,
        error: message,
        label: message,
      });
      throw err;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

function looksLikeOgg(bytes) {
  return findOggStart(bytes) >= 0;
}

function findOggStart(bytes) {
  const n = Math.max(0, bytes.length - 4);
  for (let i = 0; i <= n; i++) {
    if (
      bytes[i] === 0x4f &&
      bytes[i + 1] === 0x67 &&
      bytes[i + 2] === 0x67 &&
      bytes[i + 3] === 0x53
    ) {
      return i;
    }
  }
  return -1;
}

function ascii(bytes, start, len) {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i]);
  return s;
}

function demuxOggPackets(bytes) {
  const packets = [];
  let offset = findOggStart(bytes);
  if (offset < 0) return packets;
  let pending = [];
  while (offset + 27 <= bytes.length) {
    if (
      bytes[offset] !== 0x4f ||
      bytes[offset + 1] !== 0x67 ||
      bytes[offset + 2] !== 0x67 ||
      bytes[offset + 3] !== 0x53
    ) {
      offset += 1;
      continue;
    }
    const nseg = bytes[offset + 26];
    const tableAt = offset + 27;
    if (tableAt + nseg > bytes.length) break;
    let pos = tableAt + nseg;
    for (let i = 0; i < nseg; i++) {
      const size = bytes[tableAt + i];
      if (pos + size > bytes.length) {
        offset = bytes.length;
        break;
      }
      pending.push(bytes.subarray(pos, pos + size));
      pos += size;
      if (size < 255) {
        const total = pending.reduce((n, p) => n + p.length, 0);
        const pkt = new Uint8Array(total);
        let o = 0;
        for (const p of pending) {
          pkt.set(p, o);
          o += p.length;
        }
        packets.push(pkt);
        pending = [];
      }
    }
    offset = pos;
  }
  return packets;
}

function parseOpusHead(pkt) {
  if (!pkt || pkt.length < 19 || ascii(pkt, 0, 8) !== "OpusHead") return null;
  return {
    channels: pkt[9] || 1,
    preSkip: pkt[10] | (pkt[11] << 8),
    inputRate:
      pkt[12] | (pkt[13] << 8) | (pkt[14] << 16) | (pkt[15] << 24),
    raw: pkt,
  };
}

function mixDown(channelData) {
  if (!channelData?.length) throw new Error("Áudio sem canais.");
  if (channelData.length === 1) return channelData[0];
  const len = channelData[0].length;
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (const ch of channelData) s += ch[i] || 0;
    mono[i] = s / channelData.length;
  }
  return mono;
}

function resampleMono(mono, fromRate, toRate) {
  if (fromRate === toRate) return mono;
  const ratio = toRate / fromRate;
  const outLen = Math.max(1, Math.round(mono.length * ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const x = i / ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const f = x - i0;
    out[i] = mono[i0] * (1 - f) + mono[i1] * f;
  }
  return out;
}

function concatPlanes(planes) {
  const total = planes.reduce((n, a) => n + a.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const a of planes) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function planeFromFrame(frame, index) {
  const opts = { planeIndex: index };
  const size = frame.allocationSize(opts);
  const buf = new ArrayBuffer(size);
  frame.copyTo(buf, opts);
  const fmt = String(frame.format || "");
  if (fmt.startsWith("s16")) {
    const s16 = new Int16Array(buf);
    const f = new Float32Array(s16.length);
    for (let i = 0; i < s16.length; i++) f[i] = s16[i] / 32768;
    return f;
  }
  if (fmt.startsWith("u8")) {
    const u8 = new Uint8Array(buf);
    const f = new Float32Array(u8.length);
    for (let i = 0; i < u8.length; i++) f[i] = (u8[i] - 128) / 128;
    return f;
  }
  return new Float32Array(buf);
}

async function decodeWithWebAudio(arrayBuffer) {
  const Ctx = self.AudioContext || self.webkitAudioContext;
  if (!Ctx) throw new Error("Este navegador não decodifica áudio.");
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channels = [];
    for (let c = 0; c < audioBuf.numberOfChannels; c++) {
      channels.push(audioBuf.getChannelData(c));
    }
    return resampleMono(mixDown(channels), audioBuf.sampleRate, 16000);
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function decodeOpusWebCodecs(bytes) {
  if (typeof AudioDecoder === "undefined") {
    throw new Error("Este Chrome não tem AudioDecoder.");
  }
  const packets = demuxOggPackets(bytes);
  if (!packets.length) throw new Error("OGG sem pacotes de áudio.");
  const head = parseOpusHead(packets[0]);
  if (!head) throw new Error("Este OGG não tem cabeçalho Opus.");
  const channels = Math.max(1, head.channels || 1);
  const desc = head.raw.slice();
  const descRest = head.raw.slice(8);
  const configs = [
    { codec: "opus", sampleRate: 48000, numberOfChannels: channels, description: desc },
    { codec: "opus", sampleRate: 48000, numberOfChannels: channels, description: descRest },
    { codec: "opus", sampleRate: 48000, numberOfChannels: channels },
  ];
  let config = null;
  for (const c of configs) {
    try {
      const test = await AudioDecoder.isConfigSupported(c);
      if (test?.supported) {
        config = test.config || c;
        break;
      }
    } catch {
      /* tenta o próximo */
    }
  }
  if (!config) config = configs[configs.length - 1];

  const pcm = [];
  let sampleRate = 48000;
  let decodeErr = null;
  const decoder = new AudioDecoder({
    output(frame) {
      try {
        sampleRate = frame.sampleRate || sampleRate;
        const chs = frame.numberOfChannels || 1;
        const planes = [];
        for (let c = 0; c < chs; c++) planes.push(planeFromFrame(frame, c));
        pcm.push(mixDown(planes));
      } catch (err) {
        decodeErr = err;
      } finally {
        try {
          frame.close();
        } catch {
          /* ignore */
        }
      }
    },
    error(e) {
      decodeErr = e;
    },
  });
  decoder.configure(config);
  let ts = 0;
  for (let i = 1; i < packets.length; i++) {
    const p = packets[i];
    if (p.length >= 8 && ascii(p, 0, 8) === "OpusTags") continue;
    if (!p.length) continue;
    decoder.decode(
      new EncodedAudioChunk({
        type: "key",
        timestamp: ts,
        data: p,
      }),
    );
    ts += 20000;
  }
  await decoder.flush();
  try {
    decoder.close();
  } catch {
    /* ignore */
  }
  if (decodeErr) throw decodeErr;
  if (!pcm.length) throw new Error("O decoder nativo não gerou PCM.");
  let mono = concatPlanes(pcm);
  const skip = Math.min(head.preSkip || 0, Math.max(0, mono.length - 1));
  if (skip) mono = mono.subarray(skip);
  return resampleMono(mono, sampleRate, 16000);
}

async function ensureOpusWasm() {
  if (self["ogg-opus-decoder"]?.OggOpusDecoder) return self["ogg-opus-decoder"].OggOpusDecoder;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("vendor/ogg-opus-decoder.min.js");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Não carregou o decoder Opus da extensão."));
    document.documentElement.appendChild(s);
  });
  const lib = self["ogg-opus-decoder"];
  const Decoder = lib?.OggOpusDecoder;
  if (!Decoder) throw new Error("O arquivo do decoder Opus não exportou a classe.");
  return Decoder;
}

async function decodeWithOpusWasm(bytes) {
  const Decoder = await ensureOpusWasm();
  const decoder = new Decoder();
  await decoder.ready;
  try {
    const copy = bytes.slice();
    const result = await decoder.decodeFile(copy);
    if (!result?.channelData?.length) throw new Error("Opus WASM vazio.");
    return resampleMono(
      mixDown(result.channelData),
      result.sampleRate || 48000,
      16000,
    );
  } finally {
    try {
      decoder.free();
    } catch {
      /* ignore */
    }
  }
}

function bytesFromMsg({ audioBase64, audioBuffer, byteLength }) {
  if (typeof audioBase64 === "string" && audioBase64.length > 80) {
    try {
      const bin = atob(audioBase64);
      if (bin.length >= 64) {
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
    } catch {
      /* cai no buffer */
    }
  }
  if (audioBuffer instanceof ArrayBuffer && audioBuffer.byteLength >= 64) {
    return new Uint8Array(audioBuffer.slice(0));
  }
  if (ArrayBuffer.isView(audioBuffer) && audioBuffer.byteLength >= 64) {
    return new Uint8Array(
      audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength,
      ),
    );
  }
  const got = typeof audioBase64 === "string" ? audioBase64.length : 0;
  throw new Error(
    `O áudio não chegou no Whisper (${got} caracteres, ${byteLength || 0} bytes). Clique de novo em Transcrever.`,
  );
}

async function toMono16k(bytes, mimeType) {
  if (!bytes || bytes.byteLength < 64) {
    throw new Error(
      `O áudio chegou vazio (${bytes?.byteLength || 0} bytes). Clique de novo em Transcrever.`,
    );
  }
  const copy = bytes.slice();
  const packed = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
  const errors = [];
  try {
    return await decodeWithWebAudio(packed);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  if (looksLikeOgg(copy) || /ogg|opus/i.test(mimeType || "")) {
    try {
      return await decodeOpusWebCodecs(copy);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    try {
      return await decodeWithOpusWasm(copy);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    throw new Error(
      "Não li este Opus do WhatsApp. " + (errors.filter(Boolean).pop() || ""),
    );
  }
  throw new Error(
    "Não consegui ler este arquivo. Use o OGG do WhatsApp, MP3 ou WAV.",
  );
}

async function transcribe({ audioBase64, audioBuffer, mimeType, language, kind, byteLength, repo, requestId, key }) {
  const want = normalizeKind(kind || loaded?.kind);
  const model = await ensureModel(want, repo);
  const reemit = (partial) => {
    if (!requestId) return;
    try {
      port?.postMessage({
        type: "VOZCLARA_STT_PROGRESS",
        requestId,
        key,
        ...partial,
      });
    } catch {
      /* o SW reencaminha; se falhar, o card mantém a fase atual */
    }
  };
  emit({
    downloading: false,
    ready: true,
    percent: 100,
    label: "Transcrevendo neste Chrome…",
    model: model.label,
    device: model.device,
    kind: model.kind,
  });
  // Parte 1.2: fase ① de decode antes de toMono16k.
  reemit({ phase: "decode", label: "Lendo o áudio…" });
  const bytes = bytesFromMsg({ audioBase64, audioBuffer, byteLength });
  const audio = await toMono16k(bytes, mimeType);
  const secs = audio.length / 16000;
  const mm = Math.floor(secs / 60);
  const ss = String(Math.round(secs % 60)).padStart(2, "0");
  // Parte 1.2: fase ③ com duração real — nunca % fantasma de inferência.
  reemit({ phase: "transcribe", label: "Transcrevendo…", detail: `áudio de ${mm}:${ss}` });
  const lang = !language || language === "auto" ? null : language;
  const tiny = want === "tiny";
  const result = await model.pipe(audio, {
    language: lang || undefined,
    task: "transcribe",
    chunk_length_s: tiny ? 20 : 30,
    stride_length_s: tiny ? 4 : 5,
    condition_on_previous_text: false,
    compression_ratio_threshold: 2.4,
    logprob_threshold: -1.0,
    no_repeat_ngram_size: tiny ? 3 : 0,
    repetition_penalty: tiny ? 1.15 : 1.0,
  });
  const text = (result?.text || "").trim();
  if (!text) throw new Error("O Whisper local devolveu uma transcrição vazia.");
  emit({
    downloading: false,
    ready: true,
    percent: 100,
    label: `Pronto · ${model.label}`,
    model: model.label,
    device: model.device,
    kind: model.kind,
  });
  return { ok: true, text, model: model.label, device: model.device };
}

function snapshot() {
  return {
    ok: true,
    ready: Boolean(loaded),
    downloading: Boolean(loading),
    model: loaded?.label,
    device: loaded?.device,
    kind: loaded?.kind,
  };
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

async function exportFiles(kind) {
  const spec = MODELS[normalizeKind(kind)] || MODELS.turbo;
  const want = normalizeKind(kind);
  if (!chrome.downloads?.download) {
    throw new Error("Recarregue a extensão para liberar o Explorer.");
  }
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
      if (!url.includes(spec.repo)) continue;
      const res = await cache.match(req).catch(() => null);
      if (!res) continue;
      files.push({ url, name: fileNameFromUrl(url), res });
    }
  }
  if (!files.length) {
    throw new Error("Não achei os arquivos do Whisper neste Brave.");
  }
  const ids = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const blob = await file.res.blob();
    const objectUrl = URL.createObjectURL(blob);
    emit({
      downloading: true,
      ready: true,
      percent: Math.min(99, Math.round(((i + 1) / files.length) * 100)),
      label: `Copiando para Downloads/VozClara… ${i + 1}/${files.length}`,
      model: spec.label,
      kind: want,
    });
    try {
      const id = await chrome.downloads.download({
        url: objectUrl,
        filename: `VozClara/${spec.label}/${safeRel(file.name)}`,
        conflictAction: "overwrite",
        saveAs: false,
      });
      ids.push(id);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    }
  }
  emit({
    downloading: false,
    ready: true,
    percent: 100,
    label: `Pronto · ${spec.label}`,
    model: spec.label,
    kind: want,
    error: "",
  });
  return { ok: true, ids, model: spec.label, kind: want, copied: ids.length };
}

function reply(id, payload) {
  try {
    port?.postMessage({ id, ...payload });
  } catch {
    /* ignore */
  }
}

async function onCommand(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "VOZCLARA_MODEL_PROGRESS") return;
  const id = msg.id;
  try {
    if (msg.action === "status") {
      reply(id, snapshot());
      return;
    }
    if (msg.action === "load") {
      const m = await ensureModel(msg.kind || "turbo", msg.repo);
      reply(id, {
        ok: true,
        ready: true,
        model: m.label,
        device: m.device,
        kind: m.kind,
        repo: m.repo || "",
      });
      return;
    }
    if (msg.action === "transcribe") {
      const result = await transcribe(msg);
      reply(id, result);
      return;
    }
    if (msg.action === "export") {
      const result = await exportFiles(msg.kind || loaded?.kind || "turbo");
      reply(id, result);
    }
  } catch (err) {
    reply(id, {
      ok: false,
      error: err instanceof Error ? err.message : "Falha no Whisper local.",
    });
  }
}

function connect() {
  try {
    port = chrome.runtime.connect({ name: "vozclara-whisper" });
  } catch {
    port = null;
    setTimeout(connect, 500);
    return;
  }
  port.onMessage.addListener((msg) => {
    void onCommand(msg);
  });
  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(connect, 250);
  });
}

connect();
