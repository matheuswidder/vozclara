(() => {
  const ICON_SEL = [
    '[data-icon="audio-play"]',
    '[data-icon="audio-pause"]',
    '[data-icon="audio-play-fill"]',
    '[data-icon="ptt-status-ended"]',
    '[data-icon="ptt-status-playing"]',
    '[data-icon="ptt-status-error"]',
    '[data-icon="ptt-status-pending"]',
    '[data-icon*="audio-play"]',
    '[data-icon*="audio-pause"]',
    '[data-icon*="pr-audio"]',
    '[data-icon*="ptt"]',
    '[data-testid*="audio-play"]',
    '[data-testid*="ptt"]',
  ].join(",");

  const PLAY_SEL = [
    ICON_SEL,
    'button[aria-label*="reproduzir" i]',
    'button[aria-label*="play" i]',
    'button[aria-label*="tocar" i]',
    'button[aria-label*="pausar" i]',
    'button[aria-label*="pause" i]',
    '[role="button"][aria-label*="reproduzir" i]',
    '[role="button"][aria-label*="play" i]',
    '[role="button"][aria-label*="voz" i]',
    '[role="button"][aria-label*="voice" i]',
    '[aria-label*="mensagem de voz" i]',
    '[aria-label*="voice message" i]',
  ].join(",");

  const ARIA_SEL = [
    'button[aria-label*="voz" i]',
    'button[aria-label*="voice" i]',
    'button[aria-label*="áudio" i]',
    'button[aria-label*="audio" i]',
    'button[aria-label*="PTT" i]',
  ].join(",");

  const CARD_STYLE = `
    :host {
      all: initial;
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-family: Segoe UI, Helvetica, Arial, sans-serif;
      overflow-anchor: none;
      pointer-events: none;
      color-scheme: var(--vc-scheme, light);
    }
    .panel { pointer-events: none; }
    .box {
      pointer-events: auto;
      margin: 2px 0 4px;
      padding: 6px 10px 8px;
      background: var(--vc-panel, #ffffff);
      border: 1px solid var(--vc-line, #e9edef);
      border-radius: 7.5px;
      color: var(--vc-fg, #111b21);
      box-sizing: border-box;
    }
    .label {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; letter-spacing: .04em;
      color: var(--vc-accent, #00a884); font-weight: 600; margin-bottom: 4px;
    }
    button.tx {
      appearance: none; border: 0; cursor: pointer;
      background: var(--vc-accent, #00a884); color: #062016;
      font: 600 12.5px/1 Segoe UI, Helvetica, Arial, sans-serif;
      border-radius: 8px; padding: 8px 12px; width: 100%;
    }
    button.tx:hover { filter: brightness(1.06); }
    button.tx:disabled { opacity: .6; cursor: default; filter: none; }
    .copy, .retry, .iconbtn {
      appearance: none; border: 0; background: transparent;
      color: var(--vc-muted, #667781); cursor: pointer; font-size: 11px;
      padding: 0;
    }
    .copy:hover, .retry:hover, .iconbtn:hover { color: var(--vc-fg, #111b21); }
    .iconbtn, .ok {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    }
    .ok { color: var(--vc-accent, #00a884); }
    .iconbtn.copied { color: var(--vc-accent, #00a884); }
    .ok svg, .iconbtn svg { width: 14px; height: 14px; display: block; }
    .tools { display: flex; gap: 10px; align-items: center; }
    .text {
      margin: 0;
      font-size: 13.5px; line-height: 1.35; white-space: pre-wrap;
      color: var(--vc-fg, #111b21);
    }
    .err {
      margin: 0;
      color: var(--vc-err-fg, #f5c2c2);
      font-size: 12.5px; line-height: 1.4; font-weight: 600;
    }
    .busy {
      margin: 0;
      display: flex; align-items: center; gap: 8px;
      font-size: 12.5px; font-weight: 600;
      color: var(--vc-muted, #667781);
    }
    .bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; }
    .bars i {
      display: block; width: 3px; height: 4px; border-radius: 1px;
      background: var(--vc-accent, #00a884);
      animation: vcbars .9s ease-in-out infinite;
    }
    .bars i:nth-child(2) { animation-delay: .12s; }
    .bars i:nth-child(3) { animation-delay: .24s; }
    .bars i:nth-child(4) { animation-delay: .36s; }
    .bars i:nth-child(5) { animation-delay: .48s; }
    @keyframes vcbars {
      0%, 100% { height: 4px; }
      50% { height: 14px; }
    }
    .meter {
      height: 6px; background: rgba(128,128,128,.25); border-radius: 99px;
      overflow: hidden; margin-top: 6px;
    }
    .meter span {
      display: block; height: 100%; width: 0;
      background: var(--vc-accent, #00a884); border-radius: 99px;
      transition: width .25s ease;
    }
    .micro {
      margin: 4px 0 0; font-size: 11px; font-weight: 400;
      color: var(--vc-muted, #667781);
    }
    .box.mini {
      padding: 0; background: transparent; border: 0; border-radius: 0;
      pointer-events: auto;
    }
  `;

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>';
  const COPY_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="14" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2"/></svg>';
  function resultToolsHtml() {
    return `<span class="tools">
      <span class="ok" title="Pronto" aria-label="Pronto">${CHECK_SVG}</span>
      <button class="retry" type="button" data-retry="1">Re-transcrever</button>
      <button class="iconbtn" type="button" data-copy="1" aria-label="Copiar" title="Copiar">${COPY_SVG}</button>
    </span>`;
  }

  /** @type {Array<{ t: number; mime: string; size: number; buffer: ArrayBuffer; requestId: string }>} */
  const recentMedia = [];

  window.addEventListener("message", (ev) => {
    const data = ev.data;
    if (!data || data.source !== "vozclara") return;
    if (ev.source !== window || data.type !== "media") return;
    if (!(data.buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(data.buffer)) return;
    const raw =
      data.buffer instanceof ArrayBuffer
        ? data.buffer
        : data.buffer.buffer.slice(
            data.buffer.byteOffset,
            data.buffer.byteOffset + data.buffer.byteLength,
          );
    const buffer = raw.slice(0);
    const size = data.size || buffer.byteLength;
    if (size < 64) return;
    recentMedia.push({
      t: Date.now(),
      mime: data.mime || "audio/ogg",
      size,
      buffer,
      requestId: data.requestId || "",
    });
    if (recentMedia.length > 24) recentMedia.shift();
  });

  let silentTimer = 0;
  function setSilent(on) {
    window.clearTimeout(silentTimer);
    if (on) document.documentElement.setAttribute("data-vozclara-silent", "1");
    else document.documentElement.removeAttribute("data-vozclara-silent");
    window.postMessage({ source: "vozclara", type: "silent", on: Boolean(on) }, "*");
    if (on) {
      silentTimer = window.setTimeout(() => setSilent(false), 18000);
    }
  }

  /** @type {Element | null} */
  let lastVoice = null;
  /** @type {WeakMap<HTMLMediaElement, string>} */
  const mediaSrc = new WeakMap();
  /** @type {Map<string, string>} */
  const srcByRoot = new Map();

  function isChromeUi(el) {
    if (!el || !(el instanceof Element)) return true;
    if (el.closest("footer")) return true;
    if (el.closest("header")) return true;
    if (el.closest("#side, #pane-side")) return true;
    if (el.closest('[role="textbox"]')) return true;
    if (el.closest('[contenteditable="true"]')) return true;
    if (el.closest('[data-testid="conversation-compose-box-input"]')) return true;
    if (el.closest('[data-testid="compose-box"]')) return true;
    return false;
  }

  function rootOf(el) {
    if (!el || !(el instanceof Element) || isChromeUi(el)) return null;
    const msg = el.closest("[data-id]");
    if (msg && !isChromeUi(msg)) return msg;
    const row = el.closest('[role="row"]');
    if (row && !isChromeUi(row)) return row;
    return null;
  }

  const cardByKey = new Map();
  const htmlByKey = new Map();
  const miniByKey = new Map();
  const seenKeys = new Set();
  let scanPrimed = false;
  let autoOn = false;
  let modelReady = false;
  const autoQ = [];
  let autoBusy = false;
  // Estado explícito do auto-transcrever por chave: "queued" | "done" | "error".
  // Substitui a leitura de innerHTML como fonte primária (o HTML segue como
  // fallback para cards transcritos manualmente ou de sessões anteriores).
  const autoState = new Map();
  /** @type {Map<string, { root: Element | null; html: string }>} Parte 1.1 */
  const rootByKey = new Map();
  /** @type {Map<string, number>} requestId → interval id do cronômetro da fase ① */
  const timersByRequest = new Map();
  let mutating = false;
  let paneCache = null;
  /** @type {MutationObserver | null} */
  let obs = null;

  function chatPane() {
    if (paneCache?.isConnected) return paneCache;
    const main = document.getElementById("main");
    if (!main) return null;
    let best = null;
    let bestArea = 0;
    const nodes = main.querySelectorAll("div");
    for (const el of nodes) {
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowY)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (r.height > 200 && area > bestArea) {
        best = el;
        bestArea = area;
      }
    }
    paneCache = best;
    return best;
  }

  function withFrozenScroll(fn) {
    const pane = chatPane();
    if (!pane) return fn();
    const box = pane.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + Math.min(72, box.width / 2),
      box.top + Math.min(110, box.height / 3),
    );
    const anchor =
      hit instanceof Element ? hit.closest("[data-id]") || hit : null;
    const anchorTop =
      anchor instanceof Element ? anchor.getBoundingClientRect().top : null;
    const fromBottom = pane.scrollHeight - pane.scrollTop;
    const prev = pane.scrollTop;
    const oldAnchor = pane.style.overflowAnchor;
    pane.style.overflowAnchor = "none";
    try {
      return fn();
    } finally {
      if (anchor instanceof Element && anchor.isConnected && anchorTop != null) {
        pane.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
      } else {
        pane.scrollTop = pane.scrollHeight - fromBottom;
        if (Math.abs(pane.scrollTop - prev) < 2) pane.scrollTop = prev;
      }
      pane.style.overflowAnchor = oldAnchor;
    }
  }

  function runMutate(fn) {
    if (mutating) return fn();
    mutating = true;
    try {
      obs?.disconnect();
      return withFrozenScroll(fn);
    } finally {
      mutating = false;
      obs?.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function cardOf(root) {
    const key = keyFor(root);
    return (key && cardByKey.get(key)) || null;
  }

  function quotedMedia(root) {
    return root.querySelector(
      '[data-testid="quoted-message"], .quoted-message, [data-testid="quoted-content"]',
    );
  }

  function outsideQuote(root, node) {
    const quoted = quotedMedia(root);
    return Boolean(node && (!quoted || !quoted.contains(node)));
  }

  function hasAudioControl(root) {
    const nodes = root.querySelectorAll(
      [
        ICON_SEL,
        ARIA_SEL,
        '[aria-label*="mensagem de voz" i]',
        '[aria-label*="voice message" i]',
      ].join(","),
    );
    for (const n of nodes) {
      if (outsideQuote(root, n)) return true;
    }
    return false;
  }

  function hasSlimWaveform(root) {
    return [...root.querySelectorAll("canvas")].some((c) => {
      if (!outsideQuote(root, c)) return false;
      const r = c.getBoundingClientRect();
      return r.width >= 60 && r.width <= 280 && r.height >= 12 && r.height <= 56;
    });
  }

  function hasBigPicture(root) {
    return [...root.querySelectorAll("img, canvas")].some((n) => {
      if (!outsideQuote(root, n)) return false;
      if (n.closest('[data-icon], button, [role="button"]') && n.getBoundingClientRect().width < 80) {
        return false;
      }
      const r = n.getBoundingClientRect();
      return r.width >= 80 && r.height >= 80;
    });
  }

  function looksLikeGif(root) {
    return Boolean(
      root.querySelector(
        [
          '[data-testid*="gif" i]',
          '[data-icon*="gif" i]',
          '[aria-label*="gif" i]',
          '[alt*="gif" i]',
          'img[src*=".gif" i]',
          'img[src*="image/gif" i]',
        ].join(","),
      ),
    );
  }

  function looksLikeSticker(root) {
    return Boolean(
      root.querySelector(
        '[data-testid*="sticker" i], [data-icon*="sticker" i], [aria-label*="figurinha" i], [aria-label*="sticker" i]',
      ),
    );
  }

  function voiceProbe(root) {
    const audioIcon = hasAudioControl(root);
    const gif = looksLikeGif(root) && !audioIcon;
    return {
      video: Boolean(
        root.querySelector("video") ||
          root.querySelector('[data-icon*="video"]') ||
          root.querySelector('[data-testid*="video" i]'),
      ),
      gif,
      sticker: looksLikeSticker(root) && !audioIcon,
      bigPicture: hasBigPicture(root),
      audioIcon,
      slimWaveform: hasSlimWaveform(root),
      quotedOnly: Boolean(quotedMedia(root)) && !audioIcon && !hasSlimWaveform(root),
    };
  }

  function isVoiceRoot(root) {
    if (!root || isChromeUi(root)) return false;
    const decide = globalThis.VCShared?.shouldAttachVoiceCard;
    if (typeof decide !== "function") return hasAudioControl(root);
    return decide(voiceProbe(root));
  }

  function isOutgoing(root) {
    if (!root) return false;
    if (root.classList?.contains("message-out")) return true;
    if (root.querySelector(".message-out")) return true;
    if (root.querySelector(".message-in") || root.classList?.contains("message-in")) {
      return false;
    }
    const id = String(root.getAttribute("data-id") || "");
    if (/^true[_-]/.test(id)) return true;
    if (/^false[_-]/.test(id)) return false;
    const bubble = findTextBubble(root);
    if (!bubble) return false;
    const br = bubble.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    return br.left - rr.left > rr.right - br.right;
  }

  function findTextBubble(root) {
    return (
      root.querySelector(".copyable-text") ||
      root.querySelector('[data-testid="msg-container"]') ||
      root.querySelector("span.selectable-text")?.closest("div") ||
      root.firstElementChild ||
      root
    );
  }

  function readableText(root) {
    if (!root) return "";
    const quoted = root.querySelector(
      '[data-testid="quoted-message"], .quoted-message, [class*="quoted"]',
    );
    let best = "";
    root.querySelectorAll("span.selectable-text, span.copyable-text").forEach((n) => {
      if (quoted && quoted.contains(n)) return;
      if (n.closest("footer, header, #side")) return;
      const t = String(n.innerText || "").replace(/\s+/g, " ").trim();
      if (t.length > best.length) best = t;
    });
    if (!best) {
      const raw = String(root.innerText || "")
        .replace(quoted ? String(quoted.innerText || "") : "", "")
        .replace(/\b\d{1,2}:\d{2}\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
      best = raw;
    }
    if (/criptografad|encrypted|clique para|tap to/i.test(best) && best.length < 80) {
      return "";
    }
    return best.slice(0, 4000);
  }

  function collectRoots(from = document) {
    const set = new Set();
    const add = (n) => {
      if (!(n instanceof Element) || isChromeUi(n)) return;
      const root = n.closest?.("[data-id]") || (n.matches?.("[data-id]") ? n : null);
      if (isVoiceRoot(root)) set.add(root);
    };
    const main =
      document.querySelector("#main") ||
      document.querySelector('[data-testid="conversation-panel-messages"]') ||
      document;
    const scope = from instanceof Element ? from : main;
    if (from instanceof Element) add(from);
    scope.querySelectorAll?.("[data-id]").forEach(add);
    const list = [...set];
    return new Set(list.filter((r) => !list.some((o) => o !== r && r.contains(o))));
  }

  const weakKey = new WeakMap();
  let keySeq = 0;
  function keyFor(root) {
    const id =
      root.getAttribute("data-id") ||
      root.getAttribute("data-pre-plain-text") ||
      "";
    if (id) return id;
    if (weakKey.has(root)) return weakKey.get(root);
    const k = `vc-${++keySeq}`;
    weakKey.set(root, k);
    return k;
  }

  function findAudioCard(root) {
    const play =
      root.querySelector(ICON_SEL) ||
      root.querySelector(PLAY_SEL) ||
      root.querySelector(ARIA_SEL);
    const start = play || root;
    let el = start instanceof Element ? start.parentElement : null;
    let best = null;
    for (let i = 0; i < 20 && el && el !== root.parentElement; i++) {
      if (el.classList?.contains("vozclara-wrap") || el.classList?.contains("vozclara-card")) {
        el = el.parentElement;
        continue;
      }
      if (el === root) break;
      const cs = getComputedStyle(el);
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      const w = el.getBoundingClientRect().width;
      if (rad >= 4 && w >= 110 && w <= 520) {
        best = el;
        break;
      }
      el = el.parentElement;
    }
    if (best) return best;
    return (
      root.querySelector('[data-testid="msg-container"]') ||
      root.querySelector(".copyable-text") ||
      root.firstElementChild ||
      root
    );
  }

  function rgbLum(color) {
    const m = String(color).match(/\d+/g);
    if (!m || m.length < 3) return 180;
    const [r, g, b] = m.map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  function opaqueBg(el) {
    if (!el || !(el instanceof Element)) return "";
    const c = getComputedStyle(el).backgroundColor || "";
    const m = String(c).match(/\d+/g);
    if (!m || m.length < 3) return "";
    if (m.length >= 4 && Number(m[3]) === 0) return "";
    return c;
  }

  function appIsDark() {
    const html = document.documentElement;
    const body = document.body;
    const mark = `${html.className || ""} ${body?.className || ""} ${html.dataset.theme || ""} ${body?.dataset?.theme || ""}`.toLowerCase();
    if (/\bdark\b/.test(mark) || mark.includes("web-dark")) return true;
    if (/\blight\b/.test(mark) || mark.includes("web-light")) return false;
    const scheme = `${getComputedStyle(html).colorScheme || ""} ${getComputedStyle(body || html).colorScheme || ""}`.toLowerCase();
    if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme)) return true;
    if (/\blight\b/.test(scheme)) return false;
    const bg =
      opaqueBg(body) ||
      opaqueBg(html) ||
      opaqueBg(document.getElementById("app")) ||
      opaqueBg(document.getElementById("main"));
    return rgbLum(bg || "rgb(255,255,255)") < 90;
  }

  function paintTheme(host) {
    const dark = appIsDark();
    host.style.setProperty("--vc-accent", "#00a884");
    host.style.setProperty("--vc-scheme", dark ? "dark" : "light");
    host.style.colorScheme = dark ? "dark" : "light";
    if (dark) {
      host.style.setProperty("--vc-fg", "#e9edef");
      host.style.setProperty("--vc-muted", "#8696a0");
      host.style.setProperty("--vc-panel", "#202c33");
      host.style.setProperty("--vc-line", "#3b4a54");
      host.style.setProperty("--vc-err-fg", "#f5c2c2");
    } else {
      host.style.setProperty("--vc-fg", "#111b21");
      host.style.setProperty("--vc-muted", "#667781");
      host.style.setProperty("--vc-panel", "#ffffff");
      host.style.setProperty("--vc-line", "#e9edef");
      host.style.setProperty("--vc-err-fg", "#8b2e2e");
    }
  }

  function unwrap(wrap) {
    const parent = wrap.parentElement;
    if (!parent) {
      wrap.remove();
      return;
    }
    while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
  }

  function cleanupStrays() {
    document.querySelectorAll(".vozclara-wrap").forEach((n) => unwrap(n));
    document.querySelectorAll(".vozclara-host, .vozclara-result").forEach((n) => n.remove());
    document.getElementById("vozclara-layer-cards")?.remove();
    document.querySelectorAll(".vozclara-card").forEach((n) => {
      const key = n.dataset.vcKey;
      if (!key || cardByKey.get(key) !== n) n.remove();
      if (n.previousElementSibling?.classList.contains("vozclara-card")) n.remove();
    });
    document.querySelectorAll(".vozclara-mini").forEach((n) => {
      const key = n.dataset.vcKey;
      if (!key || miniByKey.get(key) !== n) n.remove();
    });
  }

  // Parte 7.5: preferir a duração do bloco de áudio; excluir citação (reply).
  function durationLabel(root) {
    const card = findAudioCard(root);
    if (!card) return "";
    const quoted = card.querySelector(
      '[data-testid="quoted-message"], .quoted-message, [class*="quoted"]',
    );
    const text = quoted
      ? String(card.innerText || "").replace(String(quoted.innerText || ""), "")
      : String(card.innerText || "");
    const bits = [...text.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map((m) => m[1]);
    return bits[0] || "";
  }

  function barsHtml() {
    return `<span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
  }

  function idleHtml() {
    return `<div class="box">
      <div class="label"><span>VozClara</span></div>
      <button class="tx" type="button">Transcrever</button>
    </div>`;
  }

  function makeCard(root) {
    const el = document.createElement("div");
    el.className = "vozclara-card";
    el.style.overflowAnchor = "none";
    const shadow = el.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${CARD_STYLE}</style><div class="panel">${idleHtml()}</div>`;
    paintTheme(el);
    bindTx(root, el);
    return el;
  }

  function bindResultTools(root, el) {
    const copyBtn = el.shadowRoot?.querySelector("[data-copy]");
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = "1";
      copyBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = el.shadowRoot?.querySelector(".text")?.textContent || "";
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.classList.add("copied");
          window.setTimeout(() => copyBtn.classList.remove("copied"), 1600);
        } catch {
          /* ignore */
        }
      });
    }
    const retry = el.shadowRoot?.querySelector("[data-retry]");
    if (retry && !retry.dataset.bound) {
      retry.dataset.bound = "1";
      retry.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        retry.blur();
        void transcribeRoot(root, { fresh: true });
      });
    }
  }

  function bindTx(root, el) {
    const btn = el.shadowRoot?.querySelector("button.tx");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      btn.blur();
      void transcribeRoot(root);
    });
  }

  function placeCard(audio, cardEl, root) {
    const bubble =
      audio && audio !== root && root?.contains(audio)
        ? audio
        : findAudioCard(root) || audio || root;
    const row = root || bubble.closest("[data-id]") || bubble;
    const br = bubble.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (br.width < 40) return;
    const outgoing = isOutgoing(root);
    const sibling =
      cardEl.previousElementSibling === bubble ||
      bubble.nextElementSibling === cardEl;
    const left = Math.max(0, Math.round(br.left - rr.left));
    const right = Math.max(0, Math.round(rr.right - br.right));
    const width = Math.round(br.width);
    const compact = cardEl.classList.contains("vozclara-mini");
    const top = compact ? "2px" : "6px";
    const bot = compact ? "8px" : "12px";
    const place = `${outgoing ? "out" : "in"}:${sibling ? "sib" : "row"}:${width}:${left}:${right}`;
    if (cardEl.dataset.vcPlace === place) return;
    cardEl.dataset.vcPlace = place;
    cardEl.style.display = "block";
    cardEl.style.position = "relative";
    cardEl.style.boxSizing = "border-box";
    cardEl.style.width = `${width}px`;
    cardEl.style.maxWidth = "100%";
    cardEl.style.marginTop = top;
    cardEl.style.marginBottom = bot;
    if (sibling) {
      cardEl.style.marginLeft = outgoing ? "auto" : "0";
      cardEl.style.marginRight = outgoing ? "0" : "auto";
    } else if (outgoing) {
      cardEl.style.marginLeft = "auto";
      cardEl.style.marginRight = `${right}px`;
    } else {
      cardEl.style.marginLeft = `${left}px`;
      cardEl.style.marginRight = "auto";
    }
    cardEl.style.pointerEvents = "none";
    cardEl.style.flex = "0 0 auto";
    cardEl.style.alignSelf = outgoing ? "flex-end" : "flex-start";
    cardEl.style.zIndex = "";
    cardEl.style.overflowAnchor = "none";
    paintTheme(cardEl);
  }

  function mountCard(root, audio, cardEl) {
    const bubble = audio && audio !== root && root.contains(audio) ? audio : null;
    const column = bubble?.parentElement;
    if (column && column !== root && !bubble.contains(cardEl)) {
      if (cardEl.parentElement !== column || cardEl.previousElementSibling !== bubble) {
        bubble.insertAdjacentElement("afterend", cardEl);
      }
      return;
    }
    if (cardEl.parentElement !== root) root.appendChild(cardEl);
  }

  function ensureUi(root) {
    if (!isVoiceRoot(root) || isChromeUi(root)) {
      const dead = cardOf(root);
      if (dead) {
        htmlByKey.set(keyFor(root), dead.shadowRoot?.querySelector(".panel")?.innerHTML || "");
        dead.remove();
        cardByKey.delete(keyFor(root));
      }
      return;
    }
    const audio = findAudioCard(root);
    const key = keyFor(root);
    const nested = [...root.querySelectorAll(".vozclara-card")];
    const sib = root.nextElementSibling;
    let cardEl = cardByKey.get(key);
    const found =
      nested.find((n) => n !== cardEl) ||
      (sib?.classList.contains("vozclara-card") && sib !== cardEl ? sib : null);
    if (found) {
      if (cardEl && cardEl !== found) cardEl.remove();
      cardEl = found;
      cardEl.dataset.vcKey = key;
      cardByKey.set(key, cardEl);
      bindTx(root, cardEl);
      bindResultTools(root, cardEl);
    }
    if (!cardEl || !cardEl.isConnected) {
      cardEl = makeCard(root);
      cardEl.dataset.vcKey = key;
      const kept = htmlByKey.get(key);
      if (kept) {
        const panel = cardEl.shadowRoot?.querySelector(".panel");
        if (panel) {
          panel.innerHTML = kept;
          panel.querySelectorAll("[data-bound]").forEach((n) => n.removeAttribute("data-bound"));
          bindTx(root, cardEl);
          bindResultTools(root, cardEl);
        }
      }
      cardByKey.set(key, cardEl);
    }
    const inPlace =
      root.contains(cardEl) &&
      ((audio?.parentElement && cardEl.parentElement === audio.parentElement) ||
        cardEl.parentElement === root);
    if (!inPlace) mountCard(root, audio || root, cardEl);
    placeCard(audio || root, cardEl, root);
  }

  function panelOf(root) {
    return cardOf(root)?.shadowRoot?.querySelector(".panel") ?? null;
  }

  // Parte 1.1: resolve o root vivo para uma key mesmo depois do WhatsApp
  // reciclar o DOM. O rootByKey guarda o root da última passagem de scan.
  function progressHtml(msg) {
    const phase = String(msg.phase || "transcribe");
    if (msg.ready && phase === "download") {
      return `<div class="box">
        <div class="label"><span>VozClara</span></div>
        <p class="busy">Whisper pronto. Clique em Transcrever.</p>
        <button class="tx" type="button">Transcrever</button>
      </div>`;
    }
    if (phase !== "download") {
      return `<div class="box">
        <div class="label"><span>VozClara</span></div>
        <p class="busy">${barsHtml()} Aguarde. Transcrevendo áudio…</p>
      </div>`;
    }
    const label = escapeHtml(msg.label || "Baixando Whisper…");
    const detail = msg.detail ? ` — ${escapeHtml(msg.detail)}` : "";
    const pct =
      msg.percent != null
        ? ` — ${Math.max(0, Math.min(100, Number(msg.percent) || 0))}%`
        : "";
    const bar =
      Number(msg.percent) >= 0
        ? `<div class="meter"><span style="width:${Math.max(0, Math.min(100, Number(msg.percent) || 0))}%"></span></div>`
        : "";
    return `<div class="box"><p class="busy">${barsHtml()} ${label}${detail}${pct}</p>${bar}</div>`;
  }

  function buttonOf(root) {
    return cardOf(root)?.shadowRoot?.querySelector("button.tx") ?? null;
  }

  function setPanel(root, html) {
    const el = cardOf(root);
    const panel = el?.shadowRoot?.querySelector(".panel");
    if (!panel || !el) return;
    const ae = document.activeElement;
    if (ae && el.contains(ae)) ae.blur();
    runMutate(() => {
      panel.innerHTML = html || idleHtml();
      panel.querySelectorAll("[data-bound]").forEach((n) => n.removeAttribute("data-bound"));
      htmlByKey.set(keyFor(root), panel.innerHTML);
      el.style.display = "block";
      if (!html || /button class="tx"|data-retry|data-copy/.test(html)) {
        bindTx(root, el);
        bindResultTools(root, el);
      }
    });
  }

  function scan(from) {
    runMutate(() => {
      cleanupStrays();
      const live = new Set();
      collectRoots(from).forEach((root) => {
        const key = keyFor(root);
        const isNew = Boolean(key) && !seenKeys.has(key);
        if (key) {
          live.add(key);
          seenKeys.add(key);
        }
        ensureUi(root);
        if (scanPrimed && isNew) maybeAuto(root);
      });
      for (const [key, el] of cardByKey) {
        if (!live.has(key)) {
          htmlByKey.set(key, el.shadowRoot?.querySelector(".panel")?.innerHTML || "");
          el.remove();
          cardByKey.delete(key);
        }
      }
    });
    if (!scanPrimed) scanPrimed = true;
  }

  function positionAll() {
    collectRoots(document).forEach((root) => {
      const el = cardOf(root);
      if (el) placeCard(findAudioCard(root) || root, el, root);
    });
  }

  document.addEventListener(
    "play",
    (e) => {
      const media = e.target;
      if (!(media instanceof HTMLMediaElement) || !media.src) return;
      mediaSrc.set(media, media.src);
      const root = rootOf(media) || lastVoice;
      if (root) srcByRoot.set(keyFor(root) || String(Math.random()), media.src);
    },
    true,
  );

  document.addEventListener(
    "loadedmetadata",
    (e) => {
      const media = e.target;
      if (!(media instanceof HTMLMediaElement) || !media.src) return;
      const root = rootOf(media) || lastVoice;
      if (root) srcByRoot.set(keyFor(root) || "last", media.src);
    },
    true,
  );

  document.addEventListener(
    "contextmenu",
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const root = rootOf(t);
      if (isVoiceRoot(root)) {
        lastVoice = root;
        e.stopImmediatePropagation();
      } else {
        lastVoice = null;
      }
    },
    true,
  );

  /** @type {Map<string, string>} requestId → key (Parte 1.1) */
  const jobs = new Map();
  /** @type {Map<string, { cancel: boolean }>} requestId → flag de cancelamento (Parte 7.4) */
  const cancelled = new Map();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "VOZCLARA_PROGRESS") {
      // Parte 1.1: roteamento por key/requestId — nunca por lastVoice.
      const key = msg.key || (msg.requestId ? jobs.get(msg.requestId) : "");
      const root = (key ? rootByKey.get(key)?.root : null) || lastVoice;
      if (msg.requestId && cancelled.get(msg.requestId)?.cancel) return;
      if (msg.requestId && timersByRequest.has(msg.requestId)) {
        window.clearInterval(timersByRequest.get(msg.requestId));
        timersByRequest.delete(msg.requestId);
      }
      const html = progressHtml(msg);
      if (!root || !document.contains(root)) {
        if (key) htmlByKey.set(key, html);
        return;
      }
      setPanel(root, html);
      return;
    }
    if (msg?.type === "VOZCLARA_STT_CANCELLED") {
      // Parte 7.4: SW confirmou o cancelamento (ou o card cancelou sozinho no caminho).
      const key = msg.key || (msg.requestId ? jobs.get(msg.requestId) : "");
      cancelled.set(msg.requestId, { cancel: true });
      const root = (key ? rootByKey.get(key)?.root : null) || lastVoice;
      if (root) {
        setPanel(
          root,
          `<div class="box"><p class="busy">Cancelado — a leitura em curso termina em segundo plano.</p>
           <button class="tx" type="button">Transcrever</button></div>`,
        );
      }
      return;
    }
    if (msg?.type !== "VOZCLARA_CONTEXT") return;
    const root = lastVoice;
    if (!root || !document.contains(root)) {
      flashPage("Clique com o botão direito em cima do áudio.");
      return;
    }
    void transcribeRoot(root);
  });

  function flashPage(text) {
    let n = document.getElementById("vozclara-toast");
    if (!n) {
      n = document.createElement("div");
      n.id = "vozclara-toast";
      n.style.cssText =
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:999999;background:#111;color:#eee;padding:10px 14px;border-radius:8px;font:13px/1.3 Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)";
      document.documentElement.appendChild(n);
    }
    n.textContent = text;
    window.setTimeout(() => n?.remove(), 2600);
  }

  function findAudioEl(root) {
    const pick = (a) => (a?.src || a?.currentSrc ? a : null);
    const local = root?.querySelector?.("audio");
    if (pick(local)) return local;
    const all = [...document.querySelectorAll("audio")].filter((a) => a.src || a.currentSrc);
    const contained = all.find((a) => root?.contains?.(a));
    if (contained) return contained;
    return all.at(-1) || null;
  }

  function clickPlay(root) {
    const scope = findAudioCard(root) || root;
    if (
      scope.querySelector('[data-icon*="pause"]') ||
      scope.querySelector('[aria-label*="pausar" i]') ||
      scope.querySelector('[aria-label*="pause" i]')
    ) {
      return;
    }
    const nodes = [
      ...scope.querySelectorAll(PLAY_SEL),
      ...scope.querySelectorAll(ICON_SEL),
      ...scope.querySelectorAll("button, [role='button']"),
    ];
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest(".vozclara-card")) continue;
      const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`;
      if (/transcrev|copiar|copy|baixar/i.test(label)) continue;
      el.click();
      return;
    }
  }

  function clickPause(root) {
    const icon =
      root.querySelector('[data-icon*="pause"]') ||
      root.querySelector('[aria-label*="pausar" i]') ||
      root.querySelector('[aria-label*="pause" i]');
    const btn = icon?.closest("button, [role='button']") || icon;
    if (btn instanceof HTMLElement) btn.click();
  }

  const mediaSnap = new WeakMap();

  // Parte 4.1: snapshot/mute/restore restritos ao elemento da mensagem alvo —
  // nunca toda a página (vídeo/áudio em outra conversa não é afetado).
  function snapshotMedia(media) {
    if (!media || mediaSnap.has(media)) return;
    mediaSnap.set(media, {
      muted: media.muted,
      volume: media.volume,
      defaultMuted: media.defaultMuted,
      rate: media.playbackRate,
    });
  }

  function muteForCapture(media) {
    if (!media) return;
    snapshotMedia(media);
    try {
      media.muted = true;
      media.defaultMuted = true;
      media.volume = 0;
      media.playbackRate = 16;
    } catch {
      /* ignore */
    }
  }

  function restoreMedia(media) {
    if (!media) {
      document.querySelectorAll("audio, video").forEach((m) => {
        if (mediaSnap.has(m)) restoreMedia(m);
      });
      window.postMessage({ source: "vozclara", type: "restore" }, "*");
      return;
    }
    const s = mediaSnap.get(media);
    try {
      media.pause();
    } catch {
      /* ignore */
    }
    try {
      media.muted = false;
      media.defaultMuted = false;
      media.removeAttribute("muted");
      media.volume = s && s.volume > 0 ? s.volume : 1;
      media.playbackRate = s?.rate > 0 && s.rate <= 2 ? s.rate : 1;
      if (Number.isFinite(media.duration) && media.duration > 0) {
        media.currentTime = 0;
      }
    } catch {
      /* ignore */
    }
    mediaSnap.delete(media);
    window.postMessage({ source: "vozclara", type: "restore" }, "*");
  }

  function releasePlayback() {
    window.clearTimeout(silentTimer);
    document.documentElement.removeAttribute("data-vozclara-silent");
    window.postMessage({ source: "vozclara", type: "silent", on: false }, "*");
    restoreMedia();
  }

  function blobFromCapture(since) {
    const hit = [...recentMedia]
      .reverse()
      .find((row) => row.t >= since && row.buffer.byteLength >= 512);
    if (!hit) return null;
    return new Blob([hit.buffer.slice(0)], { type: hit.mime || "audio/ogg" });
  }

  function requestPageBlob(src, ms = 8000) {
    if (!src) return Promise.resolve(null);
    const id = `vc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onMsg);
        resolve(null);
      }, ms);
      const onMsg = (ev) => {
        if (ev.source !== window) return;
        const data = ev.data;
        if (!data || data.source !== "vozclara" || data.requestId !== id) return;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        if (data.type === "media" && data.buffer && data.buffer.byteLength >= 64) {
          const buf =
            data.buffer instanceof ArrayBuffer
              ? data.buffer.slice(0)
              : data.buffer.buffer.slice(
                  data.buffer.byteOffset,
                  data.buffer.byteOffset + data.buffer.byteLength,
                );
          resolve(new Blob([buf], { type: data.mime || "audio/ogg" }));
          return;
        }
        resolve(null);
      };
      window.addEventListener("message", onMsg);
      window.postMessage(
        { source: "vozclara", type: "fetch-src", src, requestId: id },
        "*",
      );
    });
  }

  // Parte 4.1b: amarrado ao root da mensagem alvo — lastVoice muda no
  // contextmenu e desviaria o blob nos 14 s da rota forçada.
  function waitForCapture(root, since, ms = 14000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = async () => {
        const captured = blobFromCapture(since);
        if (captured && captured.size >= 512) {
          resolve(captured);
          return;
        }
        const audio = findAudioEl(root);
        if (audio?.src) {
          const blob = await requestPageBlob(audio.src, 2500);
          if (blob && blob.size >= 512) {
            resolve(blob);
            return;
          }
        }
        const k = root ? keyFor(root) : "";
        const remembered = k ? srcByRoot.get(k) : "";
        if (remembered) {
          const blob = await requestPageBlob(remembered, 2500);
          if (blob && blob.size >= 512) {
            resolve(blob);
            return;
          }
        }
        if (Date.now() - start > ms) {
          reject(
            new Error(
              "Não consegui ler o áudio desta mensagem. Recarregue o WhatsApp e clique de novo em Transcrever.",
            ),
          );
          return;
        }
        window.setTimeout(() => void tick(), 120);
      };
      void tick();
    });
  }

  async function blobFromSrc(src) {
    const fromPage = await requestPageBlob(src, 6000);
    if (fromPage && fromPage.size >= 64) return fromPage;
    const res = await fetch(src);
    if (!res.ok) throw new Error("Não consegui baixar o áudio desta mensagem.");
    return res.blob();
  }

  async function extractBlob(root) {
    lastVoice = root;
    const trySrc = async (src) => {
      if (!src) return null;
      try {
        const blob = await blobFromSrc(src);
        return blob.size >= 512 ? blob : null;
      } catch {
        return null;
      }
    };
    const existing = findAudioEl(root);
    let got = await trySrc(existing?.src || existing?.currentSrc);
    if (got) return got;
    got = await trySrc(srcByRoot.get(keyFor(root)));
    if (got) return got;
    const since = Date.now();
    setSilent(true);
    const alvo = findAudioEl(root);
    muteForCapture(alvo);
    try {
      clickPlay(root);
      muteForCapture(findAudioEl(root) || alvo);
      await new Promise((r) => setTimeout(r, 450));
      const again = findAudioEl(root);
      got = await trySrc(again?.src || again?.currentSrc);
      if (got) return got;
      const blob = await waitForCapture(root, since);
      if (!blob || blob.size < 512) {
        throw new Error(
          "O WhatsApp ainda não entregou o arquivo. Clique de novo em Transcrever.",
        );
      }
      return blob;
    } finally {
      restoreMedia();
      releasePlayback();
      clickPause(root);
      const el = findAudioEl(root);
      if (el) {
        try {
          el.pause();
        } catch {
          /* ignore */
        }
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        restoreMedia(el);
      }
    }
  }

  function bufferToBase64(buf) {
    const u8 = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function transcribeRoot(root, opts = {}) {
    lastVoice = root;
    ensureUi(root);
    const btn = buttonOf(root);
    if (btn) btn.disabled = true;
    const key = keyFor(root);
    const requestId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `vc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    jobs.set(requestId, key);
    rootByKey.set(key, { root, html: "" });
    cancelled.delete(requestId);

    setPanel(
      root,
      `<div class="box">
         <div class="label"><span>VozClara</span>
           <button class="copy" type="button" data-cancel="${requestId}" aria-label="Cancelar">Cancelar</button>
         </div>
         <p class="busy">${barsHtml()} Aguarde. Transcrevendo áudio…</p>
       </div>`,
    );
    let cancelledHere = false;

    // Bind do botão Cancelar (Parte 7.4 — só na fase ①; a ③ também aceita via mesmo id).
    panelOf(root)?.addEventListener("click", (e) => {
      const el = e.target instanceof Element ? e.target : null;
      const id = el?.dataset?.cancel;
      if (!id) return;
      cancelledHere = true;
      cancelled.set(requestId, { cancel: true });
      chrome.runtime.sendMessage({ type: "VOZCLARA_STT_CANCEL", requestId }).catch(() => {});
      window.clearInterval(timersByRequest.get(requestId));
      timersByRequest.delete(requestId);
      setPanel(
        root,
        `<div class="box"><p class="busy">Cancelado — a leitura em curso termina em segundo plano.</p>
         <button class="tx" type="button">Transcrever</button></div>`,
      );
    });

    // Parte 1.4: oferta de download no próprio card quando o modelo não está pronto.
    let status = null;
    try {
      status = await chrome.runtime.sendMessage({ type: "VOZCLARA_MODEL_STATUS" });
    } catch {
      status = null;
    }
    if (status && status.ok && !status.ready && !status.downloading && !cancelledHere) {
      window.clearInterval(timersByRequest.get(requestId));
      timersByRequest.delete(requestId);
      const modelKind = status.kind || "turbo";
      const sizeHint = modelKind === "large" ? "~1,5 GB" : "~560 MB";
      setPanel(
        root,
        `<div class="box">
           <div class="label"><span>VozClara</span></div>
           <p class="busy">Whisper ainda não foi baixado (${sizeHint}, só uma vez).</p>
           <button class="tx" type="button" data-download="${requestId}" style="margin-top:8px">Baixar agora</button>
         </div>`,
      );
      panelOf(root)?.querySelector("[data-download]")?.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "VOZCLARA_MODEL_DOWNLOAD",
          kind: modelKind,
          requestId,
          key,
        }).catch(() => {});
        setPanel(root, progressHtml({ phase: "download", percent: 1, label: "Preparando Whisper" }));
      });
      if (btn) btn.disabled = false;
      return "";
    }
    if (status && status.ok && status.downloading && !cancelledHere) {
      // ② em andamento: mostra % real atual, sem erro.
      setPanel(
        root,
        `<div class="box"><p class="busy">${barsHtml()} ② Preparando Whisper — ${escapeHtml(String(status.percent || 0))}%</p></div>`,
      );
    }

    try {
      if (cancelledHere) return "";
      const blob = await extractBlob(root);
      if (!blob || blob.size < 512) {
        throw new Error(
          "O WhatsApp ainda não entregou o arquivo. Clique de novo em Transcrever.",
        );
      }
      const audioBuffer = await blob.arrayBuffer();
      if (!audioBuffer || audioBuffer.byteLength < 64) {
        throw new Error(
          "O WhatsApp entregou um arquivo vazio. Clique de novo em Transcrever.",
        );
      }
      const audioBase64 = bufferToBase64(audioBuffer);
      const result = await chrome.runtime.sendMessage({
        type: "VOZCLARA_STT",
        requestId,
        key,
        audioBase64,
        mimeType: blob.type || "audio/ogg",
        fileName: "voice.ogg",
        byteLength: audioBuffer.byteLength,
        fresh: Boolean(opts.fresh),
      });
      if (cancelledHere || cancelled.get(requestId)?.cancel) return "";
      if (!result?.ok) {
        setPanel(
          root,
          `<div class="box">
             <div class="label"><span>VozClara</span></div>
             <p class="err">${escapeHtml(result?.error || "Falha ao transcrever.")}</p>
             <button class="tx" type="button" style="margin-top:8px">Tentar de novo</button>
           </div>`,
        );
        return "";
      }
      const safe = escapeHtml(result.text);
      const note = result.cleaned
        ? `<p class="micro">O modelo repetiu demais — texto limpo. Clique em Re-transcrever se quiser tentar de novo.</p>`
        : "";
      const langNote = result.langCleaned
        ? `<p class="micro">Tirei trechos em outro alfabeto (filtro do idioma).</p>`
        : "";
      setPanel(
        root,
        `<div class="box">
           <div class="label"><span>VozClara</span>
             ${resultToolsHtml()}
           </div>
           <p class="text">${safe}</p>
           ${note}
           ${langNote}
         </div>`,
      );
      return result.text || "";
    } catch (err) {
      if (cancelledHere || cancelled.get(requestId)?.cancel) return "";
      const raw = err instanceof Error ? err.message : "Falha ao transcrever.";
      setPanel(
        root,
        `<div class="box">
           <div class="label"><span>VozClara</span></div>
           <p class="err">${escapeHtml(raw)}</p>
           <button class="tx" type="button" style="margin-top:8px">Tentar de novo</button>
         </div>`,
      );
      return "";
    } finally {
      window.clearInterval(timersByRequest.get(requestId));
      timersByRequest.delete(requestId);
      jobs.delete(requestId);
      if (btn) btn.disabled = false;
      releasePlayback();
    }
  }

  function panelHtml(root) {
    return (
      cardOf(root)?.shadowRoot?.querySelector(".panel")?.innerHTML ||
      htmlByKey.get(keyFor(root)) ||
      ""
    );
  }

  function isJobRunning(key) {
    for (const k of jobs.values()) if (k === key) return true;
    return false;
  }

  function alreadyDone(root) {
    if (autoState.get(keyFor(root)) === "done") return true;
    return /data-copy|data-retry/.test(panelHtml(root));
  }

  function alreadyBusy(root) {
    const key = keyFor(root);
    if (isJobRunning(key)) return true;
    return /Aguarde|Transcrevendo|Baixando Whisper/.test(panelHtml(root));
  }

  function isNearBottom(root) {
    const pane = chatPane();
    if (!pane || !root) return false;
    const pr = pane.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    return rr.bottom >= pr.bottom - 220 && rr.top <= pr.bottom + 80;
  }

  function maybeAuto(root) {
    if (!autoOn || !modelReady || document.hidden) return;
    if (!root || isOutgoing(root) || !isVoiceRoot(root)) return;
    const key = keyFor(root);
    if (!key || autoState.has(key)) return;
    if (!isNearBottom(root)) return;
    if (alreadyDone(root) || alreadyBusy(root)) return;
    if (autoQ.length >= 6) return;
    autoState.set(key, "queued");
    autoQ.push(root);
    void pumpAuto();
  }

  async function pumpAuto() {
    if (autoBusy) return;
    autoBusy = true;
    try {
      while (autoQ.length) {
        const root = autoQ.shift();
        const key = keyFor(root);
        if (!root?.isConnected || !autoOn || !modelReady) {
          if (key && autoState.get(key) === "queued") autoState.delete(key);
          continue;
        }
        if (alreadyDone(root)) {
          autoState.set(key, "done");
          continue;
        }
        if (isJobRunning(key)) {
          // Transcrição manual em curso: o painel dela decide o futuro.
          autoState.delete(key);
          continue;
        }
        const text = await transcribeRoot(root);
        // Erro não retenta sozinho; o usuário retenta no card.
        autoState.set(key, text ? "done" : "error");
      }
    } finally {
      autoBusy = false;
    }
  }

  // O que chega com a aba oculta não dispara (maybeAuto trava em
  // document.hidden) e o scan já marcou a chave como vista. Ao voltar,
  // varre a conversa aberta uma vez; done/busy/error barram duplicata.
  function catchUpAuto() {
    if (!autoOn || !modelReady || document.hidden) return;
    collectRoots(document).forEach((root) => maybeAuto(root));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  obs = new MutationObserver((records) => {
    if (mutating) return;
    for (const rec of records) {
      const target = rec.target instanceof Element ? rec.target : rec.target?.parentElement;
      if (target?.closest?.(".vozclara-card, .vozclara-mini, .vozclara-dock, #vozclara-layer")) continue;
      const ours = [...rec.addedNodes, ...rec.removedNodes].every(
        (n) =>
          n instanceof Element &&
          (n.classList.contains("vozclara-card") ||
            n.classList.contains("vozclara-mini") ||
            n.closest(".vozclara-card, .vozclara-mini")),
      );
      if (ours && rec.addedNodes.length + rec.removedNodes.length > 0) continue;
      scheduleScan();
      return;
    }
  });

  let scanTick = 0;
  function scheduleScan() {
    if (scanTick) return;
    scanTick = window.setTimeout(() => {
      scanTick = 0;
      scan(document);
    }, 400);
  }

  // Parte 7.3: interval de 2,5 s só com a aba visível; o Observer segue sempre.
  let idleScan = null;
  function startIdleScan() {
    if (idleScan) return;
    idleScan = window.setInterval(() => scan(document), 2500);
  }
  function stopIdleScan() {
    if (!idleScan) return;
    window.clearInterval(idleScan);
    idleScan = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopIdleScan();
    else {
      scan(document);
      startIdleScan();
      catchUpAuto();
    }
  });

  chrome.storage.local
    .get(["autoTranscribe", "localModelReady"])
    .then((s) => {
      autoOn = Boolean(s.autoTranscribe);
      modelReady = Boolean(s.localModelReady);
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    if (ch.autoTranscribe) autoOn = Boolean(ch.autoTranscribe.newValue);
    if (ch.localModelReady) modelReady = Boolean(ch.localModelReady.newValue);
  });

  function start() {
    scan(document);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", () => {
      paneCache = null;
      positionAll();
    });
    if (!document.hidden) startIdleScan();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
