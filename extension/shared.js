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

  const GEMMA_META = {
    e2b: {
      id: "e2b",
      name: "E2B",
      tag: "base · não conversa",
      repo: "google/gemma-4-E2B",
      tipTitle: "E2B — modelo cru",
      tip: "Aprendeu a língua, mas não foi treinado para atender. Completa frase; não sugere resposta de WhatsApp. Deixe para pesquisa.",
    },
    it: {
      id: "it",
      name: "E2B-it",
      tag: "recomendado · conversa",
      repo: "google/gemma-4-E2B-it",
      tipTitle: "E2B-it — o que responde",
      tip: "O mesmo E2B, treinado para seguir instruções. Lê a transcrição, o tom e o texto da empresa, e propõe 3 respostas prontas.",
    },
    assistant: {
      id: "assistant",
      name: "E2B-it + acelerador",
      tag: "mais rápido · 78 MB extra",
      repo: "google/gemma-4-E2B-it-assistant",
      tipTitle: "Acelerador, não o cérebro",
      tip: "O -assistant sozinho não entende a conversa. É um rascunho de 78 MB que adivinha tokens na frente do E2B-it (~2–3×). O VozClara liga os dois juntos.",
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

  function gemmaAction(state, selected) {
    const want = normalizeGemma(selected);
    const meta = gemmaMeta(want);
    const g = state?.gemma && typeof state.gemma === "object" ? state.gemma : {};
    const motorUp = Boolean(state?.motorUp || state?.motorAlive);
    const readyKind = normalizeGemma(g.kind);
    if (g.error && !g.loading && !g.ready) {
      return {
        id: "retry",
        label: "Tentar de novo",
        disabled: false,
        status: explainGemmaError(g.error),
        kind: "warn",
      };
    }
    if (g.stale || state?.gemmaStale || state?.gemmaWaiting) {
      return {
        id: "update",
        label: "Rodar o Setup do zip",
        disabled: false,
        status: "Motor antigo — o Setup já está em engine/",
        kind: "warn",
      };
    }
    if (!motorUp) {
      return {
        id: "wake",
        label: "Ligar o motor",
        disabled: false,
        status: "Bandeja desligada",
        kind: "warn",
      };
    }
    if (g.loading) {
      const pct = Number(g.percent) || 0;
      return {
        id: "wait",
        label: pct ? `${pct}%` : "Baixando…",
        disabled: true,
        status: g.detail || "Baixando…",
        kind: "warn",
        percent: pct,
      };
    }
    if (g.ready && readyKind === want) {
      return {
        id: "ready",
        label: "Pronto",
        disabled: true,
        status: `Pronto · ${meta.name}`,
        kind: "ok",
      };
    }
    if (g.ready) {
      return {
        id: "switch",
        label: `Usar ${meta.name}`,
        disabled: false,
        status: meta.name,
        kind: "warn",
      };
    }
    return {
      id: "download",
      label: `Baixar ${meta.name}`,
      disabled: false,
      status: "Não baixou",
      kind: "warn",
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
      return "A Hugging Face bloqueou o Gemma 4. Abra huggingface.co/google/gemma-4-E2B-it, aceite o termo da Google e clique de novo.";
    }
    if (/no space|enospc|espaço em disco|disk quota/i.test(low)) {
      return "Falta espaço em disco para o Gemma (cerca de 4 GB).";
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
    return GEMMA_META[k] || GEMMA_META.it;
  }

  function normalizeGemma(kind) {
    const k = String(kind || "").toLowerCase();
    if (k === "e2b" || k === "base" || k === "gemma-4-e2b") return "e2b";
    if (k === "assistant" || k === "e2b-it-assistant" || k === "turbo-gemma") {
      return "assistant";
    }
    return "it";
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
    if (want === "nemotron") return "Verificando o motor no PC…";
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
      if (downloading) return { id: "wait", label: "Verificando…", disabled: true };
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
    const phase = String(state?.phase || "");
    const percent = Number(state?.percent) || 0;
    const detail = String(state?.detail || "").trim();
    const error = String(state?.error || "").trim();
    let motor = { kind: "off", text: "Não instalado" };
    if (up || alive) motor = { kind: "ok", text: "Ligado" };
    else if (installed) motor = { kind: "warn", text: "Desligado" };
    let model = {
      kind: "",
      text: "Aguardando o motor",
      percent: 0,
      indeterminate: false,
    };
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
    const rows = Array.isArray(thread) ? thread : [];
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i] || {};
      const body = String(item.text || "").replace(/\s+/g, " ").trim();
      const last = i === rows.length - 1;
      if (!body && !item.voice && !last) continue;
      const who = item.outgoing ? "você" : "eles";
      const kind = item.voice ? "áudio" : "texto";
      const tag = last && item.voice ? `${who} (${kind}, esta mensagem)` : `${who} (${kind})`;
      lines.push(`${tag}: ${body || "(sem texto)"}`);
    }
    if (!lines.length) return "";
    return (
      "Responda ao último áudio. Use o resto da conversa só como contexto.\n\n" +
      lines.join("\n") +
      "\n\nTrês respostas prontas para colar:"
    );
  }

  globalThis.VCShared = {
    normalizeKind,
    parseHfRepo,
    modelMeta,
    gemmaMeta,
    gemmaView,
    gemmaAction,
    explainGemmaError,
    normalizeGemma,
    stateLabel,
    stateKind,
    MOTOR_SETUP_HINT,
    downloadLabel,
    primaryAction,
    motorView,
    collapseRepeats,
    isRepeatLoop,
    setQualityFallback,
    takeQualityFallback,
    formatSuggestPrompt,
  };
})();
