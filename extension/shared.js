// VozClara shared (Parte 6) — IIFE clássica, compatível com:
// - content script clássico no Chrome 116 (dock via manifest, antes de content/dock.js)
// - popup/options via <script src="shared.js"> antes de popup.js
// - service worker clássico (background.js mantém cópia com "// SYNC: shared.js")
// Não assume DOM; só define globalThis.VCShared.
(() => {
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

  function stateLabel(state) {
    const ready = Boolean(state?.ready);
    const downloading = Boolean(state?.downloading);
    if (state?.error) return state.error;
    if (state?.label) return state.label;
    if (ready) return `Pronto · ${state.model || "Whisper"}`;
    if (downloading) return "Baixando Whisper…";
    return "Ainda não baixou. Um clique, uma vez.";
  }

  function stateKind(state) {
    if (state?.error) return "warn";
    if (Boolean(state?.ready)) return "ok";
    if (Boolean(state?.downloading)) return "warn";
    return "";
  }

  // Label de download inicial compartilhado entre popup e dock.
  function downloadLabel(kind, repo) {
    const want = normalizeKind(kind);
    if (want === "nemotron") return "Baixando o instalador do motor…";
    if (want === "custom") return `Baixando ${parseHfRepo(repo) || "modelo"}…`;
    if (want === "tiny") return "Baixando o tiny…";
    if (want === "light") return "Baixando a versão leve…";
    if (want === "v3") return "Baixando o v3…";
    return "Abrindo o download…";
  }

  // Parte 7.2: persistência/leitura do aviso de fallback de qualidade.
  async function setQualityFallback(label) {
    try {
      await chrome.storage.local.set({
        lastQualityFallback: { label: label || "O modelo grande não coube. Foi usada a versão leve.", at: Date.now() },
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
    stateLabel,
    stateKind,
    downloadLabel,
    setQualityFallback,
    takeQualityFallback,
  };
})();
