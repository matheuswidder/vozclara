// VozClara shared (Parte 6) — IIFE clássica, compatível com:
// - content script clássico no Chrome 116 (dock via manifest, antes de content/dock.js)
// - popup/options via <script src="shared.js"> antes de popup.js
// - service worker clássico (background.js mantém cópia com "// SYNC: shared.js")
// Não assume DOM; só define globalThis.VCShared.
(() => {
  const MODEL_META = {
    turbo: { name: "Turbo", size: "~560 MB" },
    tiny: { name: "Tiny", size: "~40 MB" },
    light: { name: "Small", size: "~120 MB" },
    v3: { name: "v3", size: "~1,5 GB" },
    nemotron: { name: "Nemotron", size: "Windows" },
    custom: { name: "Este Whisper", size: "" },
  };

  const FALLBACK_KEYS = [
    "localModelReady",
    "localModelId",
    "localModelKind",
    "localModelDevice",
    "localProgress",
    "cachedKinds",
    "preferredKind",
    "motorAlive",
    "motorUp",
    "motorInstalled",
    "gemmaReady",
    "gemmaLoading",
    "gemmaPercent",
    "gemmaDetail",
    "gemmaError",
    "gemmaStale",
    "gemmaCached",
    "gemmaBytes",
    "gemmaKind",
    "gemmaWaitingMotor",
    "gemmaOn",
  ];

  const SUGGEST_META = {
    qwen: {
      id: "qwen",
      name: "Qwen 1.5B Q4",
      tag: "~1,1 GB · CPU",
      repo: "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
      tipTitle: "Qwen2.5-1.5B-Instruct Q4",
      tip: "Modelo leve no PC. Lê a transcrição e propõe 3 respostas para colar no WhatsApp.",
    },
  };

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

  function formatGemmaSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024 * 1024) return "~1,1 GB";
    const gb = n / 1024 ** 3;
    if (gb >= 0.1) return `${gb.toFixed(1).replace(".", ",")} GB`;
    return `${Math.round(n / (1024 * 1024))} MB`;
  }

  function gemmaAction(state, selected) {
    const want = normalizeGemma(selected);
    const meta = gemmaMeta(want);
    const g = state?.gemma && typeof state.gemma === "object" ? state.gemma : {};
    const motorUp = Boolean(state?.motorUp || state?.motorAlive);
    const cached = Boolean(g.cached) || (Number(g.bytes) || 0) > 8 * 1024 * 1024;
    const size = formatGemmaSize(g.bytes);
    const canDelete = Boolean((g.ready || cached) && !g.loading);
    if (g.error && !g.loading && !g.ready) {
      return {
        id: "retry",
        label: "Tentar de novo",
        disabled: false,
        status: explainGemmaError(g.error),
        kind: "warn",
        canDelete,
      };
    }
    if (g.stale || state?.gemmaStale || state?.gemmaWaiting) {
      return {
        id: "update",
        label: "Rodar o Setup do zip",
        disabled: false,
        status: "Motor antigo — o Setup já está em engine/",
        kind: "warn",
        canDelete: false,
      };
    }
    if (!motorUp) {
      return {
        id: "wake",
        label: "Ligar o motor",
        disabled: false,
        status: "Bandeja desligada",
        kind: "warn",
        canDelete: false,
      };
    }
    if (g.loading) {
      const pct = Number(g.percent) || 0;
      const size = formatGemmaSize(g.bytes);
      const detail = String(g.detail || "").trim();
      return {
        id: "wait",
        label: pct ? `${pct}%` : "Baixando…",
        disabled: true,
        status:
          detail ||
          (pct
            ? `Baixando o Qwen da Hugging Face… ${pct}% de ${size}`
            : "Baixando o Qwen (~1,1 GB) da Hugging Face para este PC…"),
        kind: "warn",
        percent: pct,
        canDelete: false,
      };
    }
    if (g.ready) {
      return {
        id: "ready",
        label: "Pronto",
        disabled: true,
        status: `No disco · ${meta.name} · sobe na memória só ao sugerir`,
        kind: "ok",
        canDelete: true,
      };
    }
    if (cached) {
      return {
        id: "download",
        label: "Carregar",
        disabled: false,
        status: `${size} no disco — clique para usar na memória`,
        kind: "warn",
        canDelete: true,
      };
    }
    return {
      id: "download",
      label: `Baixar ${meta.name}`,
      disabled: false,
      status: "Ainda não baixou. Ao ligar as sugestões, o download começa sozinho (~1,1 GB).",
      kind: "warn",
      canDelete: false,
    };
  }

  function gemmaView(state) {
    const g = state?.gemma && typeof state.gemma === "object" ? state.gemma : {};
    const alive = Boolean(state?.motorAlive || state?.motorUp);
    const stale = Boolean(state?.gemmaStale || g.stale);
    const waiting = Boolean(state?.gemmaWaiting);
    let motor = { kind: "off", text: "Desligado" };
    if (waiting || stale) motor = { kind: "warn", text: "Atualize" };
    else if (alive) motor = { kind: "ok", text: "Ligado" };
    let model = { kind: "off", text: "Não baixou", percent: 0, indeterminate: false };
    if (g.error && !g.loading && !g.ready) {
      model = {
        kind: "warn",
        text: "Falhou",
        percent: 0,
        indeterminate: false,
      };
    } else if (g.loading) {
      const pct = Number(g.percent) || 0;
      model = {
        kind: "warn",
        text: pct ? `${pct}%` : "Baixando",
        percent: pct,
        indeterminate: pct < 2,
      };
    } else if (g.ready) {
      model = { kind: "ok", text: "Pronto", percent: 100, indeterminate: false };
    } else if (g.cached) {
      model = { kind: "ok", text: "No disco", percent: 100, indeterminate: false };
    } else if (waiting || stale) {
      model = {
        kind: "warn",
        text: "Rode o Setup do zip",
        percent: 0,
        indeterminate: false,
      };
    }
    return { motor, model };
  }

  function explainGemmaError(raw) {
    const s = String(raw || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    const low = s.toLowerCase();
    if (/reiniciou|caiu no meio|falta de ram|bastante ram/i.test(s)) return s;
    if (/gated|403|401|restricted|license|access to model|cannot access/i.test(low)) {
      return "A Hugging Face recusou o download. Confira a internet e tente de novo.";
    }
    if (/no space|enospc|espaço em disco|disk quota/i.test(low)) {
      return "Falta espaço em disco para o Qwen (cerca de 1,2 GB).";
    }
    if (/out of memory|can't allocate|cannot allocate|paged|winerror 1455|memoryerror/i.test(low)) {
      return "Faltou memória RAM. Feche outros programas e clique em Tentar de novo.";
    }
    if (/timed out|timeout|failed to resolve|connection reset|network is unreachable|offline/i.test(low)) {
      return "A Hugging Face não respondeu. Confira a internet e tente de novo.";
    }
    if (/motor antigo|não sabe baixar|rode o setup/i.test(low)) return s;
    return s.length > 280 ? s.slice(0, 277) + "…" : s;
  }

  function gemmaMeta(kind) {
    const k = normalizeGemma(kind);
    return SUGGEST_META[k] || SUGGEST_META.qwen;
  }

  function normalizeGemma(_kind) {
    return "qwen";
  }

  function modelMeta(kind) {
    return MODEL_META[normalizeKind(kind)] || MODEL_META.turbo;
  }

  function stateLabel(state) {
    const ready = Boolean(state?.ready);
    const downloading = Boolean(state?.downloading);
    if (state?.error) return state.error;
    if (downloading) return state?.label || "Baixando…";
    if (state?.label && !/ainda não baixou|um clique/i.test(state.label)) {
      return state.label;
    }
    if (ready) return `Pronto · ${state.model || "Whisper"}`;
    return "";
  }

  function stateKind(state) {
    if (state?.error) return "warn";
    if (Boolean(state?.ready)) return "ok";
    if (Boolean(state?.downloading)) return "warn";
    return "";
  }

  const MOTOR_SETUP_HINT =
    "Na primeira vez, rode engine/VozClara-Motor-Setup.exe do zip. Depois use Ligar o motor — o Setup só abre o que já está no PC, sem instalar de novo.";

  function downloadLabel(kind, repo) {
    const want = normalizeKind(kind);
    const meta = modelMeta(want);
    if (want === "nemotron") return "Procurando o motor neste PC…";
    if (want === "custom") return `Baixando ${parseHfRepo(repo) || "modelo"}…`;
    return `Baixando ${meta.name} (${meta.size})…`;
  }

  function modelHint(kind) {
    if (normalizeKind(kind) === "nemotron") {
      return "O motor Python na bandeja transcreve. Não usa o Chrome. O modelo NVIDIA só baixa na primeira transcrição.";
    }
    return "O Whisper fica neste Chrome. O áudio não sai do computador.";
  }

  function motorHeadline(state) {
    const view = motorView(state);
    const error = String(state?.error || "").trim();
    const label = String(state?.label || "").trim();
    if (error) return error;
    if (state?.checking) return "Procurando o motor neste PC…";
    if (state?.motorUp) return "Motor ligado · pronto para transcrever";
    if (state?.motorAlive) return view.model.text || "Motor ligado · modelo ainda subindo";
    if (label && !/ainda não baixou|um clique/i.test(label)) return label;
    if (Boolean(state?.downloading) || state?.checking) return "Procurando o motor neste PC…";
    if (state?.motorInstalled) return "Motor instalado, mas desligado — clique em Ligar o motor.";
    return MOTOR_SETUP_HINT;
  }

  function primaryAction(state, selected) {
    const want = normalizeKind(selected);
    const ready = Boolean(state?.ready);
    const downloading = Boolean(state?.downloading);
    const kind = normalizeKind(state?.kind);
    const cached = Array.isArray(state?.cachedKinds) && state.cachedKinds.includes(want);
    const motorUp = Boolean(state?.motorUp);
    const motorAlive = Boolean(state?.motorAlive);
    const motorInstalled = Boolean(state?.motorInstalled) || motorUp || motorAlive;
    const meta = modelMeta(want);
    if (want === "nemotron") {
      if (motorUp) return { id: "ready", label: "Motor ligado", disabled: true };
      if (motorAlive) return { id: "ready", label: "Motor ligado", disabled: true };
      if (downloading || state?.checking) {
        return { id: "wait", label: "Procurando o motor…", disabled: true };
      }
      if (motorInstalled) return { id: "wake", label: "Ligar o motor", disabled: false };
      return { id: "install", label: "Verificar o motor", disabled: false };
    }
    if (downloading) {
      return { id: "wait", label: "Baixando…", disabled: true };
    }
    if (ready && kind === want) {
      return { id: "ready", label: "Em uso", disabled: true };
    }
    if (cached) {
      return { id: "switch", label: `Usar ${meta.name}`, disabled: false };
    }
    return {
      id: "download",
      label: meta.size ? `Baixar ${meta.name} (${meta.size})` : `Baixar ${meta.name}`,
      disabled: false,
    };
  }

  function motorView(state) {
    const alive = Boolean(state?.motorAlive);
    const up = Boolean(state?.motorUp);
    const installed = Boolean(state?.motorInstalled) || alive || up;
    const checking = Boolean(state?.checking) || (Boolean(state?.downloading) && !alive && !up);
    const phase = String(state?.phase || "");
    const percent = Number(state?.percent) || 0;
    const detail = String(state?.detail || "").trim();
    const error = String(state?.error || "").trim();
    let motor = { kind: "off", text: "Não instalado" };
    if (up || alive) motor = { kind: "ok", text: "Ligado" };
    else if (checking) motor = { kind: "warn", text: "Verificando" };
    else if (installed) motor = { kind: "warn", text: "Desligado" };
    let model = {
      kind: "",
      text: "Aguardando o motor",
      percent: 0,
      indeterminate: false,
    };
    if (checking && !alive && !up) {
      model = {
        kind: "warn",
        text: "Procurando no PC",
        percent: percent || 8,
        indeterminate: true,
      };
    }
    if (up) {
      model = { kind: "ok", text: "Pronto", percent: 100, indeterminate: false };
    } else if (error && alive) {
      model = { kind: "warn", text: error, percent: 0, indeterminate: false };
    } else if (
      alive &&
      (phase === "download" || (percent > 0 && percent < 100 && phase !== "load" && phase !== "deps"))
    ) {
      model = {
        kind: "warn",
        text: detail || `Baixando o modelo… ${percent}%`,
        percent,
        indeterminate: percent < 2,
      };
    } else if (alive && phase === "deps") {
      model = {
        kind: "warn",
        text: detail || "Instalando bibliotecas no PC…",
        percent: percent || 8,
        indeterminate: true,
      };
    } else if (alive) {
      model = {
        kind: "warn",
        text: detail || "Carregando o modelo na memória…",
        percent,
        indeterminate: percent < 3,
      };
    }
    return { motor, model };
  }

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

  function isRepeatLoop(original, cleaned) {
    const raw = String(original || "");
    const out = String(cleaned || "");
    return raw.length > 80 && out.length * 2.5 < raw.length;
  }

  async function setQualityFallback(label) {
    try {
      await chrome.storage.local.set({
        lastQualityFallback: {
          label: label || "O modelo grande não coube. Foi usada a versão leve.",
          at: Date.now(),
        },
      });
    } catch {
      /* ignore */
    }
  }

  async function takeQualityFallback() {
    try {
      const stored = await chrome.storage.local.get(["lastQualityFallback"]);
      const entry = stored.lastQualityFallback;
      if (!entry) return null;
      await chrome.storage.local.remove(["lastQualityFallback"]);
      return entry;
    } catch {
      return null;
    }
  }

  function formatSuggestPrompt(thread) {
    if (typeof thread === "string") {
      return String(thread).replace(/\s+/g, " ").trim();
    }
    const rows = Array.isArray(thread) ? thread : [];
    if (!rows.length) return "";
    const last = rows[rows.length - 1] || {};
    return String(last.text || "").replace(/\s+/g, " ").trim();
  }

  function verifyRequest(kind) {
    return {
      type: "VOZCLARA_MODEL_VERIFY",
      kind: normalizeKind(kind),
    };
  }

  function fallbackLocalState(stored) {
    const src = stored && typeof stored === "object" ? stored : {};
    const progress = src.localProgress && typeof src.localProgress === "object" ? src.localProgress : {};
    const alive = Boolean(src.motorAlive);
    const up = Boolean(src.motorUp);
    return {
      ok: true,
      checked: false,
      ready: Boolean(src.localModelReady) || up,
      downloading: Boolean(progress.downloading),
      percent: Number(progress.percent) || (src.localModelReady || up ? 100 : 0),
      label: progress.label,
      error: progress.error,
      model: src.localModelId,
      kind: src.preferredKind || src.localModelKind,
      device: src.localModelDevice,
      cachedKinds: Array.isArray(src.cachedKinds) ? src.cachedKinds : [],
      motorAlive: alive,
      motorUp: up,
      motorInstalled: Boolean(src.motorInstalled) || alive || up,
      gemmaWaiting: Boolean(src.gemmaWaitingMotor),
      gemmaStale: Boolean(src.gemmaStale),
      gemma: {
        ready: Boolean(src.gemmaReady),
        loading: Boolean(src.gemmaLoading),
        percent: Number(src.gemmaPercent) || 0,
        detail: src.gemmaDetail || "",
        error: src.gemmaError || "",
        stale: Boolean(src.gemmaStale),
        cached: Boolean(src.gemmaCached),
        bytes: Number(src.gemmaBytes) || 0,
        kind: src.gemmaKind || "qwen",
      },
    };
  }

  function shouldAttachVoiceCard(info) {
    const i = info && typeof info === "object" ? info : {};
    if (i.video || i.gif || i.sticker) return false;
    if (i.quotedOnly) return false;
    if (i.bigPicture && !i.audioIcon) return false;
    return Boolean(i.audioIcon || (i.slimWaveform && !i.bigPicture));
  }

  globalThis.VCShared = {
    normalizeKind,
    parseHfRepo,
    modelMeta,
    gemmaMeta,
    gemmaView,
    gemmaAction,
    formatGemmaSize,
    explainGemmaError,
    normalizeGemma,
    stateLabel,
    stateKind,
    MOTOR_SETUP_HINT,
    FALLBACK_KEYS,
    downloadLabel,
    modelHint,
    motorHeadline,
    primaryAction,
    motorView,
    verifyRequest,
    fallbackLocalState,
    collapseRepeats,
    isRepeatLoop,
    filterTranscriptByLang,
    keepLatinTranscript,
    isLangCleaned,
    setQualityFallback,
    takeQualityFallback,
    formatSuggestPrompt,
    shouldAttachVoiceCard,
  };
})();
