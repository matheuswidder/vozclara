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

  function modelMeta(kind) {
    return MODEL_META[normalizeKind(kind)] || MODEL_META.turbo;
  }

  function stateLabel(state) {
    const ready = Boolean(state?.ready);
    const downloading = Boolean(state?.downloading);
    if (state?.error) return state.error;
    if (downloading) return state?.label || "Baixando… deixe a aba aberta.";
    if (state?.label && !/ainda não baixou|um clique/i.test(state.label)) {
      return state.label;
    }
    if (ready) return `Pronto · ${state.model || "Whisper"}`;
    return "Escolha o modelo. Se já estiver aqui, entra na hora.";
  }

  function stateKind(state) {
    if (state?.error) return "warn";
    if (Boolean(state?.ready)) return "ok";
    if (Boolean(state?.downloading)) return "warn";
    return "";
  }

  function downloadLabel(kind, repo) {
    const want = normalizeKind(kind);
    const meta = modelMeta(want);
    if (want === "nemotron") return "Baixando o instalador do Windows…";
    if (want === "custom") return `Baixando ${parseHfRepo(repo) || "modelo"}…`;
    return `Baixando ${meta.name} (${meta.size})…`;
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
      if (motorInstalled) return { id: "wake", label: "Ligar o motor", disabled: false };
      return { id: "install", label: "Instalar no Windows", disabled: false };
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
    const phase = String(state?.phase || "");
    const percent = Number(state?.percent) || 0;
    const detail = String(state?.detail || "").trim();
    const error = String(state?.error || "").trim();
    let motor = { kind: "off", text: "Não instalado" };
    if (up || alive) motor = { kind: "ok", text: "Ligado na bandeja" };
    else if (installed) motor = { kind: "warn", text: "Instalado, mas desligado" };
    let model = {
      kind: "",
      text: "Aguardando o motor",
      percent: 0,
      indeterminate: false,
    };
    if (up) {
      model = { kind: "ok", text: "Pronto para transcrever", percent: 100, indeterminate: false };
    } else if (error && alive) {
      model = { kind: "warn", text: error, percent: 0, indeterminate: false };
    } else if (alive && (phase === "download" || (percent > 0 && percent < 100 && phase !== "load" && phase !== "deps"))) {
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

  globalThis.VCShared = {
    normalizeKind,
    parseHfRepo,
    modelMeta,
    stateLabel,
    stateKind,
    downloadLabel,
    primaryAction,
    motorView,
    setQualityFallback,
    takeQualityFallback,
  };
})();
