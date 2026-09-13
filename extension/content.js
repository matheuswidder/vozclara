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
    '[data-icon*="audio"]',
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
    }
    .box {
      margin: 2px 0 4px;
      padding: 6px 10px 8px;
      background: var(--vc-panel, #1d282f);
      border-radius: 7.5px;
      color: var(--vc-fg, #e9edef);
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
    .copy {
      appearance: none; border: 0; background: transparent;
      color: var(--vc-muted, #8696a0); cursor: pointer; font-size: 11px;
      padding: 0;
    }
    .copy:hover { color: var(--vc-fg, #e9edef); }
    .tools { display: flex; gap: 10px; align-items: center; }
    .text {
      margin: 0;
      font-size: 13.5px; line-height: 1.35; white-space: pre-wrap;
      color: var(--vc-fg, #e9edef);
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
      color: var(--vc-muted, #8696a0);
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
      color: var(--vc-muted, #8696a0);
    }
    .replies { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
    button.reply {
      appearance: none; border: 1px solid rgba(0,168,132,.45);
      background: transparent; color: var(--vc-fg, #e9edef);
      font: 500 12.5px/1.35 Segoe UI, Helvetica, Arial, sans-serif;
      border-radius: 16px; padding: 6px 10px; text-align: left; cursor: pointer;
      max-width: 100%;
    }
    button.reply:hover { background: rgba(0,168,132,.12); }
    .box.mini {
      padding: 0; background: transparent; border: 0; border-radius: 0;
    }
    button.sug {
      appearance: none; border: 0; background: transparent; cursor: pointer;
      color: var(--vc-accent, #00a884);
      font: 600 11.5px/1 Segoe UI, Helvetica, Arial, sans-serif;
      padding: 4px 2px;
    }
    button.sug:hover { filter: brightness(1.12); }
    button.sug:disabled { opacity: .55; cursor: default; }
  `;

  /** @type {Array<{ t: number; mime: string; size: number; buffer: ArrayBuffer; requestId: string }>} */
  const recentMedia = [];

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.source !== "vozclara" || data.type !== "media") return;
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

  function voiceTimes(el) {
    const text = String(el?.innerText || "");
    return [...text.matchAll(/\b\d{1,2}:\d{2}\b/g)].length;
  }

  const cardByKey = new Map();
  const htmlByKey = new Map();
  const miniByKey = new Map();
  /** @type {Map<string, { root: Element | null; html: string }>} Parte 1.1 */
  const rootByKey = new Map();
  /** @type {Map<string, number>} requestId → interval id do cronômetro da fase ① */
  const timersByRequest = new Map();
  let mutating = false;
  let paneCache = null;
  let gemmaEnabled = false;
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

  function hasWaveform(root) {
    return Boolean(
      root.querySelector("canvas") ||
        root.querySelector('[data-testid*="audio"]') ||
        root.querySelector('[data-icon*="ptt"]'),
    );
  }

  function isVoiceRoot(root) {
    if (!root || isChromeUi(root)) return false;
    if (root.querySelector("video") || root.querySelector('[data-icon*="video"]')) {
      return false;
    }
    if (root.querySelector(ICON_SEL)) return true;
    if (root.querySelector(PLAY_SEL)) return true;
    if (root.querySelector(ARIA_SEL)) return true;
    if (hasWaveform(root) && voiceTimes(root) >= 1) return true;
    if (voiceTimes(root) >= 2 && root.querySelector("button, [role='button'], canvas, svg")) {
      return true;
    }
    return false;
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

  function isTextRoot(root) {
    if (!root || isChromeUi(root) || isVoiceRoot(root)) return false;
    if (root.querySelector("video") || root.querySelector('[data-icon*="video"]')) {
      return false;
    }
    if (isOutgoing(root)) return false;
    return readableText(root).length >= 2;
  }

  function collectTextRoots(from = document) {
    const set = new Set();
    const add = (n) => {
      if (!(n instanceof Element) || isChromeUi(n)) return;
      const root = n.closest?.("[data-id]") || (n.matches?.("[data-id]") ? n : null);
      if (isTextRoot(root)) set.add(root);
    };
    const main =
      document.querySelector("#main") ||
      document.querySelector('[data-testid="conversation-panel-messages"]') ||
      document;
    const scope = from instanceof Element ? from : main;
    if (from instanceof Element) add(from);
    scope.querySelectorAll?.("[data-id]").forEach(add);
    const list = [...set];
    const uniq = list.filter((r) => !list.some((o) => o !== r && r.contains(o)));
    return new Set(uniq.slice(-16));
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
    let bestW = 0;
    for (let i = 0; i < 20 && el && el !== root.parentElement; i++) {
      if (el.classList?.contains("vozclara-wrap") || el.classList?.contains("vozclara-card")) {
        el = el.parentElement;
        continue;
      }
      if (el === root) break;
      const cs = getComputedStyle(el);
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      const w = el.getBoundingClientRect().width;
      if (rad >= 4 && w >= 110 && w <= 720 && w >= bestW) {
        best = el;
        bestW = w;
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

  function paintTheme(card, host) {
    const bg = getComputedStyle(card).backgroundColor || "rgb(32,44,51)";
    const dark = rgbLum(bg) < 140;
    host.style.setProperty("--vc-accent", "#00a884");
    if (dark) {
      host.style.setProperty("--vc-fg", "#e9edef");
      host.style.setProperty("--vc-muted", "#8696a0");
      host.style.setProperty("--vc-panel", "#1d282f");
      host.style.setProperty("--vc-err-fg", "#f5c2c2");
    } else {
      host.style.setProperty("--vc-fg", "#111b21");
      host.style.setProperty("--vc-muted", "#667781");
      host.style.setProperty("--vc-panel", "#f0f2f5");
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
    bindTx(root, el);
    return el;
  }

  function miniHtml() {
    return `<div class="box mini"><button class="sug" type="button">Sugerir</button></div>`;
  }

  function makeMini(root) {
    const el = document.createElement("div");
    el.className = "vozclara-mini";
    el.style.overflowAnchor = "none";
    const shadow = el.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${CARD_STYLE}</style><div class="panel">${miniHtml()}</div>`;
    bindMini(root, el);
    return el;
  }

  function bindMini(root, el) {
    const btn = el.shadowRoot?.querySelector("button.sug");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.blur();
      void suggestFromRoot(root);
    });
  }

  function ensureMini(root) {
    if (!gemmaEnabled || !isTextRoot(root) || isChromeUi(root)) {
      const dead = miniByKey.get(keyFor(root));
      if (dead) {
        dead.remove();
        miniByKey.delete(keyFor(root));
      }
      return;
    }
    const key = keyFor(root);
    const sib = root.nextElementSibling;
    let el = miniByKey.get(key);
    if (sib?.classList.contains("vozclara-mini") && sib !== el) {
      if (el && el !== sib) el.remove();
      el = sib;
      el.dataset.vcKey = key;
      miniByKey.set(key, el);
      bindMini(root, el);
    }
    if (!el || !el.isConnected) {
      el = makeMini(root);
      el.dataset.vcKey = key;
      miniByKey.set(key, el);
    }
    const host = root.parentElement;
    if (host && (el.parentElement !== host || el.previousElementSibling !== root)) {
      root.insertAdjacentElement("afterend", el);
    }
    placeCard(findTextBubble(root) || root, el, root);
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
          copyBtn.textContent = "Copiado";
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
      if (btn.dataset.wake === "1") {
        try {
          window.open("vozclara://run", "_blank", "noopener");
        } catch {
          /* ignore */
        }
        chrome.runtime.sendMessage({ type: "VOZCLARA_MOTOR_WAKE" }).catch(() => {});
        setPanel(
          root,
          `<div class="box"><div class="label"><span>VozClara</span></div>
           <p class="busy">${barsHtml()} Ligando o motor na bandeja…</p>
           <button class="tx" type="button">Transcrever</button></div>`,
        );
        return;
      }
      void transcribeRoot(root);
    });
  }

  function placeCard(audio, cardEl, root) {
    const bubble = audio || root;
    const row = root || bubble.closest("[data-id]") || bubble;
    const br = bubble.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (br.width < 40) return;
    const outgoing = br.left - rr.left > rr.right - br.right;
    const left = Math.max(0, Math.round(br.left - rr.left));
    const width = Math.round(br.width);
    const compact = cardEl.classList.contains("vozclara-mini");
    const gap = compact ? "2px 0 8px" : "6px 0 12px";
    const margin = outgoing ? `${gap} auto` : `${gap} ${left}px`;
    if (cardEl.dataset.vcW === String(width) && cardEl.dataset.vcM === margin) return;
    cardEl.dataset.vcW = String(width);
    cardEl.dataset.vcM = margin;
    cardEl.style.display = "block";
    cardEl.style.position = "relative";
    cardEl.style.boxSizing = "border-box";
    cardEl.style.width = `${width}px`;
    cardEl.style.margin = margin;
    cardEl.style.maxWidth = "100%";
    cardEl.style.pointerEvents = "auto";
    cardEl.style.zIndex = "5";
    cardEl.style.overflowAnchor = "none";
    paintTheme(bubble, cardEl);
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
    const sib = root.nextElementSibling;
    let cardEl = cardByKey.get(key);
    if (sib?.classList.contains("vozclara-card") && sib !== cardEl) {
      if (cardEl && cardEl !== sib) cardEl.remove();
      cardEl = sib;
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
          bindTx(root, cardEl);
          bindResultTools(root, cardEl);
        }
      }
      cardByKey.set(key, cardEl);
    }
    const host = root.parentElement;
    if (host && (cardEl.parentElement !== host || cardEl.previousElementSibling !== root)) {
      root.insertAdjacentElement("afterend", cardEl);
    }
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
    const mark = phase === "download" ? "②" : phase === "decode" ? "①" : "③";
    const label = escapeHtml(msg.label || "Transcrevendo…");
    const detail = msg.detail ? ` — ${escapeHtml(msg.detail)}` : "";
    const pct =
      phase === "download" && msg.percent != null
        ? ` — ${Math.max(0, Math.min(100, Number(msg.percent) || 0))}%`
        : "";
    const bar =
      phase === "download" && Number(msg.percent) >= 0
        ? `<div class="meter"><span style="width:${Math.max(0, Math.min(100, Number(msg.percent) || 0))}%"></span></div>`
        : "";
    const clockSlot = phase === "transcribe" ? `<span data-clock></span>` : "";
    return `<div class="box"><p class="busy">${barsHtml()} ${mark} ${label}${detail}${pct} ${clockSlot}</p>${bar}</div>`;
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
        if (key) live.add(key);
        ensureUi(root);
      });
      for (const [key, el] of cardByKey) {
        if (!live.has(key)) {
          htmlByKey.set(key, el.shadowRoot?.querySelector(".panel")?.innerHTML || "");
          el.remove();
          cardByKey.delete(key);
        }
      }
      const liveMini = new Set();
      if (gemmaEnabled) {
        collectTextRoots(from).forEach((root) => {
          const key = keyFor(root);
          if (key) liveMini.add(key);
          ensureMini(root);
        });
      }
      for (const [key, el] of miniByKey) {
        if (!liveMini.has(key)) {
          el.remove();
          miniByKey.delete(key);
        }
      }
    });
    ensureSmartBar();
  }

  function positionAll() {
    collectRoots(document).forEach((root) => {
      const el = cardOf(root);
      if (el) placeCard(findAudioCard(root) || root, el, root);
    });
    if (gemmaEnabled) {
      collectTextRoots(document).forEach((root) => {
        const el = miniByKey.get(keyFor(root));
        if (el) placeCard(findTextBubble(root) || root, el, root);
      });
    }
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
      // Parte 7.4: SW confirmou o cancelamento (ou o card cancelou sozinho no caminho nuvem).
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
      setSilent(false);
      clickPause(root);
      const el = findAudioEl(root);
      if (el) {
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
    const dur = durationLabel(root);

    // Fase ① com cronômetro que só atualiza o relógio — nunca pinta por cima
    // da ②/③ (o listener de VOZCLARA_PROGRESS derruba este timer no 1º tick).
    let ticks = 0;
    const clock = () =>
      `${Math.floor(ticks / 60)}:${String(ticks % 60).padStart(2, "0")}`;
    const phaseHtml = (extra) =>
      `<div class="box">
         <div class="label"><span>VozClara</span>
           <button class="copy" type="button" data-cancel="${requestId}" aria-label="Cancelar">Cancelar</button>
         </div>
         <p class="busy">${barsHtml()} ① ${dur ? `Lendo áudio de ${escapeHtml(dur)}` : "Lendo o áudio"}… <span data-clock>${clock()}</span></p>
         <p class="micro">${escapeHtml(extra)}</p>
       </div>`;
    setPanel(root, phaseHtml("o áudio toca silenciosamente para leitura"));
    const timer = window.setInterval(() => {
      ticks += 1;
      const span = panelOf(root)?.querySelector("[data-clock]");
      if (span) span.textContent = clock();
    }, 1000);
    timersByRequest.set(requestId, timer);
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
      const sizeHint =
        modelKind === "v3"
          ? "~1,5 GB"
          : modelKind === "light"
            ? "~120 MB"
            : modelKind === "tiny"
              ? "~40 MB"
              : "~560 MB";
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
      return;
    }
    if (status && status.ok && status.downloading && !cancelledHere) {
      // ② em andamento: mostra % real atual, sem erro.
      setPanel(
        root,
        `<div class="box"><p class="busy">${barsHtml()} ② Preparando Whisper — ${escapeHtml(String(status.percent || 0))}%</p></div>`,
      );
    }

    try {
      if (cancelledHere) return;
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
      if (cancelledHere || cancelled.get(requestId)?.cancel) return;
      if (!result?.ok) {
        setPanel(
          root,
          `<div class="box">
             <div class="label"><span>VozClara</span></div>
             <p class="err">${escapeHtml(result?.error || "Falha ao transcrever.")}</p>
             <button class="tx" type="button" style="margin-top:8px">Tentar de novo</button>
           </div>`,
        );
        return;
      }
      const spent = clock();
      const device = result.device ? ` · ${escapeHtml(result.device)}` : "";
      const model = result.model ? ` · ${escapeHtml(result.model)}` : "";
      const safe = escapeHtml(result.text);
      const note = result.cleaned
        ? `<p class="micro">O tiny repetiu demais — texto limpo. Troque o modelo e clique em De novo.</p>`
        : "";
      const gemmaOn = Boolean((await chrome.storage.local.get(["gemmaOn"])).gemmaOn);
      gemmaEnabled = gemmaOn;
      const suggest = gemmaOn
        ? `<div class="replies" data-suggest="1"><p class="micro">Sugerindo respostas…</p></div>`
        : "";
      setPanel(
        root,
        `<div class="box">
           <div class="label"><span>VozClara</span>
             <span class="tools">
               <button class="copy" type="button" data-retry="1">De novo</button>
               <button class="copy" type="button" data-copy="1" aria-label="Copiar">Copiar</button>
             </span>
           </div>
           <p class="text">${safe}</p>
           <p class="micro">✓ Pronto${model}${device} · ${spent}</p>
           ${note}
           ${suggest}
         </div>`,
      );
      if (gemmaOn) void fillSuggestions(root, result.text);
    } catch (err) {
      if (cancelledHere || cancelled.get(requestId)?.cancel) return;
      const raw = err instanceof Error ? err.message : "Falha ao transcrever.";
      const motor = /motor|bandeja|relógio|Nemotron não está ligado/i.test(raw);
      setPanel(
        root,
        `<div class="box">
           <div class="label"><span>VozClara</span></div>
           <p class="err">${escapeHtml(raw)}</p>
           <button class="tx" type="button" style="margin-top:8px" ${motor ? 'data-wake="1"' : ""}>${motor ? "Ligar motor" : "Tentar de novo"}</button>
         </div>`,
      );
    } finally {
      window.clearInterval(timersByRequest.get(requestId));
      timersByRequest.delete(requestId);
      jobs.delete(requestId);
      if (btn) btn.disabled = false;
    }
  }

  function composeBox() {
    return (
      document.querySelector("#main footer [contenteditable='true']") ||
      document.querySelector("footer [contenteditable='true']") ||
      document.querySelector('[contenteditable="true"][data-tab]') ||
      document.querySelector('[data-testid="conversation-compose-box-input"]')
    );
  }

  function composeFooter() {
    const box = composeBox();
    return (
      document.querySelector("#main footer") ||
      box?.closest("footer") ||
      box?.closest('[data-testid="compose-box"]') ||
      null
    );
  }

  function composeEmpty() {
    const box = composeBox();
    if (!box) return true;
    return !String(box.innerText || "").replace(/\u00a0/g, " ").trim();
  }

  function insertCompose(text) {
    const box = composeBox();
    if (!box) return false;
    box.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      /* segue */
    }
    const ok = document.execCommand("insertText", false, text);
    try {
      box.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          data: text,
          inputType: "insertText",
        }),
      );
    } catch {
      /* ignore */
    }
    return Boolean(ok) || Boolean(box.innerText);
  }

  function lastIncomingText() {
    const main = document.querySelector("#main") || document;
    const nodes = [...main.querySelectorAll("[data-id]")];
    for (let i = nodes.length - 1; i >= 0; i--) {
      const root = nodes[i];
      if (isChromeUi(root) || isOutgoing(root)) continue;
      if (isVoiceRoot(root)) {
        const t = cardOf(root)?.shadowRoot?.querySelector(".text")?.textContent || "";
        if (t.trim()) return t.trim();
        continue;
      }
      const t = readableText(root);
      if (t) return t;
    }
    return "";
  }

  const SMART_ID = "vozclara-smart";
  const SMART_CSS = `
    :host { all: initial; display: block; overflow-anchor: none; font-family: Segoe UI, Helvetica, Arial, sans-serif; }
    .bar { padding: 6px 12px 2px; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    button.go {
      appearance: none; border: 0; cursor: pointer;
      background: #00a884; color: #062016;
      font: 600 12px/1 Segoe UI, Helvetica, Arial, sans-serif;
      border-radius: 16px; padding: 7px 12px;
    }
    button.go:disabled { opacity: .55; cursor: default; }
    button.chip {
      appearance: none; cursor: pointer;
      border: 1px solid rgba(0,168,132,.45); background: transparent;
      color: inherit; font: 500 12.5px/1.3 Segoe UI, Helvetica, Arial, sans-serif;
      border-radius: 16px; padding: 6px 10px; max-width: 100%; text-align: left;
    }
    button.chip:hover { background: rgba(0,168,132,.12); }
    button.x {
      appearance: none; border: 0; background: transparent; cursor: pointer;
      color: #8696a0; font-size: 16px; line-height: 1; padding: 4px 6px;
    }
    .hint { margin: 4px 0 0; font-size: 11px; color: #8696a0; }
    .light { color: #111b21; }
    .dark { color: #e9edef; }
  `;

  function smartHost() {
    return document.getElementById(SMART_ID);
  }

  function ensureSmartBar() {
    if (!gemmaEnabled) {
      smartHost()?.remove();
      return;
    }
    const footer = composeFooter();
    if (!footer) return;
    let host = smartHost();
    if (!host) {
      host = document.createElement("div");
      host.id = SMART_ID;
      host.style.overflowAnchor = "none";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `<style>${SMART_CSS}</style><div class="bar dark"><div class="row"></div><p class="hint"></p></div>`;
      host.dataset.mode = "idle";
    }
    if (host.parentElement !== footer) {
      footer.insertBefore(host, footer.firstChild);
    }
    const fg = getComputedStyle(footer).color;
    const dark = rgbLum(fg) > 140;
    shadowBar(host).className = `bar ${dark ? "dark" : "light"}`;
    if (host.dataset.mode === "idle") paintSmartIdle();
    bindComposeWatch();
  }

  function shadowBar(host) {
    return host.shadowRoot?.querySelector(".bar");
  }

  function paintSmartIdle() {
    const host = smartHost();
    if (!host?.shadowRoot) return;
    host.dataset.mode = "idle";
    const row = host.shadowRoot.querySelector(".row");
    const hint = host.shadowRoot.querySelector(".hint");
    const has = Boolean(lastIncomingText());
    if (row) {
      row.innerHTML = `<button class="go" type="button" ${has ? "" : "disabled"}>Sugerir resposta</button>`;
      const go = row.querySelector(".go");
      go?.addEventListener("click", (e) => {
        e.preventDefault();
        void suggestLastIncoming();
      });
    }
    if (hint) hint.textContent = has ? "Da última mensagem recebida" : "Espere uma mensagem para sugerir";
  }

  function paintSmartBusy() {
    const host = smartHost();
    if (!host?.shadowRoot) return;
    host.dataset.mode = "busy";
    const row = host.shadowRoot.querySelector(".row");
    const hint = host.shadowRoot.querySelector(".hint");
    if (row) row.innerHTML = `<button class="go" type="button" disabled>Sugerindo…</button>`;
    if (hint) hint.textContent = "No motor do Windows. Primeira vez pode demorar.";
  }

  function showSmartChips(replies, error) {
    ensureSmartBar();
    const host = smartHost();
    if (!host?.shadowRoot) return;
    const row = host.shadowRoot.querySelector(".row");
    const hint = host.shadowRoot.querySelector(".hint");
    if (!row) return;
    if (error || !replies?.length) {
      host.dataset.mode = "idle";
      paintSmartIdle();
      if (hint) hint.textContent = error || "Não sugeri agora.";
      return;
    }
    host.dataset.mode = "chips";
    row.innerHTML =
      replies
        .slice(0, 3)
        .map((line) => `<button class="chip" type="button">${escapeHtml(line)}</button>`)
        .join("") + `<button class="x" type="button" aria-label="Fechar">×</button>`;
    row.querySelectorAll("button.chip").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const line = btn.textContent || "";
        if (insertCompose(line)) {
          paintSmartIdle();
        } else {
          navigator.clipboard.writeText(line).catch(() => {});
          btn.textContent = "Copiado";
        }
      });
    });
    row.querySelector(".x")?.addEventListener("click", () => paintSmartIdle());
    if (hint) hint.textContent = "Clique cola no campo";
  }

  let composeBound = false;
  function bindComposeWatch() {
    if (composeBound) return;
    composeBound = true;
    document.addEventListener(
      "input",
      (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (!t.closest("footer")) return;
        const host = smartHost();
        if (host?.dataset.mode === "chips" && !composeEmpty()) paintSmartIdle();
      },
      true,
    );
  }

  async function askGemma(text) {
    const result = await chrome.runtime.sendMessage({
      type: "VOZCLARA_SUGGEST",
      text,
    });
    if (!result?.ok || !Array.isArray(result.replies) || !result.replies.length) {
      throw new Error(result?.error || "Não sugeri agora. Ligue o motor.");
    }
    return result.replies.slice(0, 3);
  }

  async function suggestLastIncoming() {
    const text = lastIncomingText();
    if (!text) {
      showSmartChips([], "Não achei uma mensagem para responder.");
      return;
    }
    paintSmartBusy();
    try {
      const replies = await askGemma(text);
      showSmartChips(replies);
    } catch (err) {
      showSmartChips([], err instanceof Error ? err.message : "Não sugeri.");
    }
  }

  async function suggestFromRoot(root) {
    const text =
      cardOf(root)?.shadowRoot?.querySelector(".text")?.textContent?.trim() ||
      readableText(root);
    const el = miniByKey.get(keyFor(root));
    const btn = el?.shadowRoot?.querySelector("button.sug");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sugerindo…";
    }
    paintSmartBusy();
    try {
      const replies = await askGemma(text);
      showSmartChips(replies);
      if (el) {
        const slot = `<div class="box mini"><div class="replies">${replies
          .map((line) => `<button class="reply" type="button">${escapeHtml(line)}</button>`)
          .join("")}</div></div>`;
        const panel = el.shadowRoot?.querySelector(".panel");
        if (panel) panel.innerHTML = slot;
        panel?.querySelectorAll("button.reply").forEach((b) => {
          b.addEventListener("click", (e) => {
            e.preventDefault();
            const line = b.textContent || "";
            if (insertCompose(line)) showSmartChips(replies);
          });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não sugeri.";
      showSmartChips([], msg);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Sugerir";
      }
    }
  }

  async function fillSuggestions(root, text) {
    const slot = panelOf(root)?.querySelector("[data-suggest]");
    if (!slot || !text) return;
    try {
      if (!gemmaEnabled) {
        slot.remove();
        return;
      }
      paintSmartBusy();
      const replies = await askGemma(text);
      slot.innerHTML = replies
        .map((line) => `<button class="reply" type="button">${escapeHtml(line)}</button>`)
        .join("");
      slot.querySelectorAll("button.reply").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const line = btn.textContent || "";
          if (insertCompose(line)) {
            showSmartChips(replies);
          } else {
            navigator.clipboard.writeText(line).catch(() => {});
            btn.textContent = "Copiado";
          }
        });
      });
      showSmartChips(replies);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não sugeri.";
      slot.innerHTML = `<p class="micro">${escapeHtml(msg)}</p>`;
      showSmartChips([], msg);
    }
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
      if (target?.closest?.(".vozclara-card, .vozclara-mini, .vozclara-dock, #vozclara-layer, #vozclara-smart")) continue;
      const ours = [...rec.addedNodes, ...rec.removedNodes].every(
        (n) =>
          n instanceof Element &&
          (n.classList.contains("vozclara-card") ||
            n.classList.contains("vozclara-mini") ||
            n.id === SMART_ID ||
            n.closest(".vozclara-card, .vozclara-mini, #vozclara-smart")),
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
    }
  });

  function start() {
    chrome.storage.local.get(["gemmaOn"]).then((s) => {
      gemmaEnabled = Boolean(s.gemmaOn);
      scan(document);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.gemmaOn) return;
      gemmaEnabled = Boolean(changes.gemmaOn.newValue);
      if (!gemmaEnabled) {
        for (const [, el] of miniByKey) el.remove();
        miniByKey.clear();
        smartHost()?.remove();
      }
      scan(document);
    });
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
