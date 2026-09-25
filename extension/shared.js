// VozClara shared (Parte 6) — IIFE clássica, compatível com:
// - content script clássico no Chrome 116 (dock via manifest, antes de content/dock.js)
// - popup/options via <script src="shared.js"> antes de popup.js
// - service worker clássico (background.js mantém cópia com "// SYNC: shared.js")
// Não assume DOM; só define globalThis.VCShared.
(() => {
  const MODEL_META = {
    turbo: { name: "Large Turbo", size: "~560 MB" },
    large: { name: "Large", size: "~1,5 GB" },
  };

  const FALLBACK_KEYS = [
    "localModelReady",
    "localModelId",
    "localModelKind",
    "localModelDevice",
    "localProgress",
    "cachedKinds",
    "preferredKind",
  ];

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
    if (state?.ready) return "ok";
    if (state?.downloading) return "warn";
    return "";
  }

  function downloadLabel(kind, repo) {
    const want = normalizeKind(kind);
    const meta = modelMeta(want);
    if (want === "custom") return `Baixando ${parseHfRepo(repo) || "modelo"}…`;
    return `Baixando ${meta.name} (${meta.size})…`;
  }

  function modelHint(kind) {
    if (normalizeKind(kind) === "large") {
      return "Large é o mais preciso (~1,5 GB). Large Turbo continua o padrão.";
    }
    return "Large Turbo é o padrão. O áudio não sai deste Chrome.";
  }

  function primaryAction(state, selected) {
    const want = normalizeKind(selected);
    const ready = Boolean(state?.ready);
    const downloading = Boolean(state?.downloading);
    const kind = normalizeKind(state?.kind);
    const cached = Array.isArray(state?.cachedKinds) && state.cachedKinds.includes(want);
    const meta = modelMeta(want);
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
          label: label || "O modelo grande não coube. Foi usado o Large Turbo.",
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

  function verifyRequest(kind) {
    return {
      type: "VOZCLARA_MODEL_VERIFY",
      kind: normalizeKind(kind),
    };
  }

  function fallbackLocalState(stored) {
    const src = stored && typeof stored === "object" ? stored : {};
    const progress = src.localProgress && typeof src.localProgress === "object" ? src.localProgress : {};
    return {
      ok: true,
      checked: false,
      ready: Boolean(src.localModelReady),
      downloading: Boolean(progress.downloading),
      percent: Number(progress.percent) || (src.localModelReady ? 100 : 0),
      label: progress.label,
      error: progress.error,
      model: src.localModelId,
      kind: src.preferredKind || src.localModelKind,
      device: src.localModelDevice,
      cachedKinds: Array.isArray(src.cachedKinds) ? src.cachedKinds : [],
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
    stateLabel,
    stateKind,
    FALLBACK_KEYS,
    downloadLabel,
    modelHint,
    primaryAction,
    verifyRequest,
    fallbackLocalState,
    collapseRepeats,
    isRepeatLoop,
    filterTranscriptByLang,
    keepLatinTranscript,
    isLangCleaned,
    setQualityFallback,
    takeQualityFallback,
    shouldAttachVoiceCard,
  };
})();
