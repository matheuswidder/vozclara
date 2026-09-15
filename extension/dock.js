(() => {
  const BTN_ID = "vozclara-rail-btn";
  const LAYER_ID = "vozclara-layer";

  const SVG = `
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="4" y="10" width="2.2" height="7" rx="1.1" fill="currentColor"/>
      <rect x="8" y="6" width="2.2" height="12" rx="1.1" fill="currentColor"/>
      <rect x="12" y="4" width="2.2" height="16" rx="1.1" fill="currentColor"/>
      <rect x="16" y="8" width="2.2" height="10" rx="1.1" fill="currentColor"/>
    </svg>`;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: Segoe UI, Helvetica, Arial, sans-serif; }
    .layer { position: fixed; inset: 0; z-index: 2147483000; display: none; }
    .layer.open { display: block; }
    .back { position: absolute; inset: 0; background: rgba(11, 20, 26, .4); }
    .sheet {
      position: absolute; top: 10px; bottom: 10px; left: 68px;
      width: min(360px, calc(100vw - 84px));
      background: var(--bg); color: var(--fg);
      border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.28);
      display: flex; flex-direction: column; overflow: hidden;
    }
    header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-bottom: 1px solid var(--line);
    }
    .mark {
      width: 32px; height: 32px; border-radius: 9px; flex: 0 0 auto;
      background: #0b3d32;
      background-image:
        linear-gradient(#00a884,#00a884), linear-gradient(#00a884,#00a884),
        linear-gradient(#00a884,#00a884), linear-gradient(#00a884,#00a884),
        linear-gradient(#00a884,#00a884);
      background-size: 2.5px 8px, 2.5px 14px, 2.5px 18px, 2.5px 11px, 2.5px 7px;
      background-position: 7px 12px, 11px 9px, 15px 7px, 19px 10px, 23px 13px;
      background-repeat: no-repeat;
    }
    header strong { display: block; font-size: 16px; font-weight: 600; }
    header p { margin: 1px 0 0; font-size: 12px; color: var(--muted); }
    header p.ok, header p[data-kind="ok"] { color: #00a884; }
    header p.warn, header p[data-kind="warn"] { color: #e9c46a; }
    .x {
      margin-left: auto; border: 0; background: transparent;
      color: var(--muted); width: 32px; height: 32px; border-radius: 50%;
      cursor: pointer; font-size: 20px; line-height: 1;
    }
    .x:hover { background: var(--hover); color: var(--fg); }
    .body { padding: 14px; overflow: auto; flex: 1; }
    label {
      display: flex; flex-direction: column; gap: 5px; margin: 0 0 10px;
      font-size: 11px; font-weight: 600; color: var(--muted);
    }
    select, input[type="password"], input[type="text"] {
      appearance: none; border: 1px solid var(--line); background: var(--field);
      color: var(--fg); border-radius: 8px; padding: 8px 10px; font-size: 13.5px;
      font-weight: 400;
    }
    .actions { display: flex; gap: 8px; margin: 0 0 10px; }
    .actions button { min-width: 0; flex: 1; }
    button.act {
      border: 0; background: #00a884; color: #111b21;
      font-weight: 600; border-radius: 8px; padding: 9px 10px; cursor: pointer;
      font-size: 13px; transition: transform .12s ease, filter .12s ease;
    }
    button.act:hover { filter: brightness(1.06); }
    button.act:active:not(:disabled) { transform: translateY(1px); }
    button.act:disabled { opacity: .55; cursor: default; filter: none; transform: none; }
    button.ghost {
      border: 1px solid var(--line); background: transparent; color: var(--fg);
      border-radius: 8px; padding: 9px 12px; cursor: pointer; font-size: 13px;
    }
    .meter { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; margin: 0 0 10px; }
    .meter[hidden], #motor-panel[hidden], #custom-fields[hidden], #cloud-fields[hidden],
    #local-fields[hidden], #confirm[hidden],
    #motor-hint[hidden], #model-hint[hidden], [hidden] { display: none !important; }
    .hint {
      margin: 0 0 10px; padding: 8px 10px; border-radius: 8px;
      background: color-mix(in srgb, #00a884 10%, var(--field));
      border: 1px solid color-mix(in srgb, #00a884 28%, var(--line));
      font-size: 12px; line-height: 1.45; color: var(--muted);
    }
    .flash { animation: vc-flash .65s ease; border-radius: 6px; }
    @keyframes vc-flash {
      from { background: color-mix(in srgb, #00a884 22%, transparent); }
      to { background: transparent; }
    }
    .hint .mono { color: var(--fg); font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
    .meter.indeterminate span { width: 38% !important; animation: vc-slide 1.15s ease-in-out infinite; }
    .meter span { display: block; height: 100%; width: 0; background: #00a884; }
    @keyframes vc-slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(280%); } }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 10px; }
    .pill {
      display: flex; align-items: center; gap: 8px; min-height: 36px;
      padding: 6px 10px; border-radius: 8px; background: var(--field);
      font-size: 12px; font-weight: 500;
    }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #667781; flex: 0 0 auto; }
    .dot.ok { background: #00a884; }
    .dot.warn { background: #e9c46a; animation: vc-pulse 1.2s ease-in-out infinite; }
    .dot.off { background: #667781; }
    @keyframes vc-pulse { 50% { opacity: .35; } }
    .status { margin: 0 0 8px; font-size: 12px; line-height: 1.4; color: var(--muted); white-space: pre-wrap; }
    .status.ok { color: #00a884; }
    .status.warn { color: #e9c46a; }
    .confirm { margin: 0 0 10px; padding: 10px; border-radius: 8px; background: var(--field); }
    .confirm p { margin: 0 0 8px; font-size: 13px; font-weight: 400; }
    .confirm .actions { margin: 0; }
    .test { padding: 10px; border-radius: 8px; background: var(--field); }
    .test p { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
    .test .drop { font-weight: 400; }
    .out { margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: var(--bg); font-size: 13px; line-height: 1.4; white-space: pre-wrap; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    .light { --bg:#fff; --fg:#111b21; --muted:#667781; --line:#e9edef; --field:#f0f2f5; --hover:#f0f2f5; }
    .dark { --bg:#202c33; --fg:#e9edef; --muted:#8696a0; --line:#3b4a54; --field:#111b21; --hover:#2a3942; }
    .help {
      margin: 12px 0 0; border: 1px solid var(--line); border-radius: 8px; background: var(--field);
    }
    .help summary {
      list-style: none; cursor: pointer; padding: 10px 12px;
      font-size: 12.5px; font-weight: 600; color: var(--fg);
    }
    .help summary::-webkit-details-marker { display: none; }
    .help summary::after {
      content: ""; float: right; width: 6px; height: 6px; margin-top: 5px;
      border-right: 1.5px solid var(--muted); border-bottom: 1.5px solid var(--muted);
      transform: rotate(45deg);
    }
    .help[open] summary::after { transform: rotate(-135deg); margin-top: 8px; }
    .help dl { margin: 0; padding: 0 12px 12px; border-top: 1px solid var(--line); }
    .help dt { margin: 10px 0 2px; font-size: 12px; font-weight: 600; color: var(--fg); }
    .help dd { margin: 0; font-size: 12px; line-height: 1.45; color: var(--muted); }
  `;

  let shadow = null;
  let raf = 0;
  let lastPreferred = "turbo";
  let motorPoll = null;

  function metaOf(kind) {
    return globalThis.VCShared.modelMeta(kind);
  }

  function flashEl(el) {
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  function isDark() {
    const html = document.documentElement;
    const body = document.body;
    const mark = `${html.className || ""} ${body?.className || ""} ${html.dataset.theme || ""} ${body?.dataset?.theme || ""}`.toLowerCase();
    if (/\bdark\b/.test(mark) || mark.includes("web-dark")) return true;
    if (/\blight\b/.test(mark) || mark.includes("web-light")) return false;
    const scheme = `${getComputedStyle(html).colorScheme || ""} ${getComputedStyle(body || html).colorScheme || ""}`.toLowerCase();
    if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme)) return true;
    if (/\blight\b/.test(scheme)) return false;
    const nodes = [body, html, document.getElementById("app"), document.getElementById("main")];
    for (const node of nodes) {
      if (!node) continue;
      const bg = getComputedStyle(node).backgroundColor;
      const m = String(bg || "").match(/\d+/g);
      if (!m || m.length < 3) continue;
      const [r, g, b] = m.map(Number);
      const a = m[3] != null ? Number(m[3]) : 1;
      if (a === 0) continue;
      return (r * 299 + g * 587 + b * 114) / 1000 < 90;
    }
    return false;
  }

  function findRail() {
    const icons = document.querySelectorAll(
      '[data-icon="chat"], [data-icon="chats-outline"], [data-icon="chats-filled"], [data-icon="calls"], [data-icon="status-v3"], [data-icon="newsletter"], [data-icon="newsletter-outline"], [data-icon="community"], [data-icon="community-outline"], [data-icon="menu"]',
    );
    let best = null;
    let bestH = 0;
    icons.forEach((icon) => {
      let el = icon.parentElement;
      for (let i = 0; i < 12 && el; i++) {
        const r = el.getBoundingClientRect();
        if (r.left < 120 && r.width >= 44 && r.width <= 100 && r.height >= 180) {
          if (r.height > bestH) {
            best = el;
            bestH = r.height;
          }
        }
        el = el.parentElement;
      }
    });
    return best;
  }

  function makeBtn() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.title = "VozClara";
    btn.setAttribute("aria-label", "VozClara");
    btn.innerHTML = `${SVG}<i class="vc-dot" aria-hidden="true"></i>`;
    btn.style.cssText = [
      "position:relative",
      "width:42px",
      "height:42px",
      "margin:6px auto",
      "display:grid",
      "place-items:center",
      "border:0",
      "background:transparent",
      "border-radius:50%",
      "cursor:pointer",
      "color:#00a884",
      "flex:0 0 auto",
    ].join(";");
    const dot = btn.querySelector(".vc-dot");
    if (dot) {
      dot.style.cssText =
        "position:absolute;right:7px;bottom:7px;width:8px;height:8px;border-radius:50%;background:#8696a0;box-shadow:0 0 0 2px currentColor;";
    }
    btn.addEventListener("mouseenter", () => {
      btn.style.background = isDark() ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
    });
    btn.addEventListener("mouseleave", () => {
      if (btn.getAttribute("aria-pressed") !== "true") btn.style.background = "transparent";
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    paintDot(btn);
    return btn;
  }

  async function paintDot(btn) {
    const dot = btn?.querySelector(".vc-dot");
    if (!dot) return;
    try {
      const stored = await chrome.storage.local.get([
        "localModelReady",
        "localProgress",
        "provider",
        "motorAlive",
        "motorUp",
      ]);
      const downloading = Boolean(stored.localProgress?.downloading);
      const ready = Boolean(stored.localModelReady) || Boolean(stored.motorUp) || Boolean(stored.motorAlive);
      const cloud = stored.provider && stored.provider !== "local";
      dot.style.background = downloading ? "#f6c344" : ready || cloud ? "#00a884" : "#8696a0";
    } catch {
      /* ignore */
    }
  }

  function placeBtn(rail, btn) {
    let slot = document.getElementById(BTN_ID + "-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.id = BTN_ID + "-slot";
      slot.style.cssText =
        "width:100%;display:flex;justify-content:center;align-items:center;flex:0 0 auto;padding:4px 0 8px;pointer-events:auto;";
    }
    if (btn.parentElement !== slot) slot.appendChild(btn);
    if (rail.contains(slot)) return;
    const settings =
      rail.querySelector('[data-icon="settings"], [data-icon="settings-outline"]') ||
      rail.querySelector('[data-icon="menu"]');
    const settingsBtn = settings?.closest("button, [role='button'], div");
    const parent = settingsBtn?.parentElement;
    if (parent && rail.contains(parent)) {
      parent.insertBefore(slot, settingsBtn);
      return;
    }
    const buttons = [...rail.querySelectorAll("button, [role='button']")];
    const last = buttons[buttons.length - 1];
    if (last?.parentElement && last.parentElement !== rail) {
      last.parentElement.insertBefore(slot, last);
    } else if (last) {
      last.insertAdjacentElement("beforebegin", slot);
    } else {
      rail.appendChild(slot);
    }
  }

  function ensureButton() {
    const rail = findRail();
    let btn = document.getElementById(BTN_ID);
    if (rail) {
      const fallback = document.getElementById("vozclara-rail-fallback");
      if (fallback) fallback.remove();
      if (!btn) btn = makeBtn();
      placeBtn(rail, btn);
      return;
    }
    if (btn && btn.closest("#vozclara-rail-fallback")) return;
    if (!document.body) return;
    let host = document.getElementById("vozclara-rail-fallback");
    if (!host) {
      host = document.createElement("div");
      host.id = "vozclara-rail-fallback";
      host.style.cssText = "position:fixed;left:8px;bottom:148px;z-index:2147480000;";
      document.body.appendChild(host);
    }
    if (!btn) btn = makeBtn();
    if (btn.parentElement !== host) host.appendChild(btn);
  }

  function layerRoot() {
    let host = document.getElementById(LAYER_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = LAYER_ID;
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${CSS}</style>
      <div class="layer light" id="layer">
        <div class="back" id="back"></div>
        <aside class="sheet" role="dialog" aria-label="VozClara">
          <header>
            <div class="mark"></div>
            <div>
              <strong>VozClara</strong>
              <p id="local-status">—</p>
            </div>
            <button class="x" id="close" type="button" aria-label="Fechar">×</button>
          </header>
          <div class="body">
            <label>Provedor
              <select id="provider">
                <option value="local">Neste computador</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
                <option value="xai">xAI</option>
              </select>
            </label>
            <div id="cloud-fields" hidden>
              <label>Chave
                <input id="apiKey" type="password" spellcheck="false" autocomplete="off" placeholder="Cole a chave" />
              </label>
            </div>
            <div id="local-fields">
              <label>Modelo
                <select id="model">
                  <option value="turbo">Whisper Turbo · 560 MB</option>
                  <option value="tiny">Whisper Tiny · 40 MB</option>
                  <option value="light">Whisper Small · 120 MB</option>
                  <option value="v3">Whisper v3 · 1,5 GB</option>
                  <option value="nemotron">Motor Windows · Nemotron</option>
                  <option value="custom">Outro Whisper</option>
                </select>
              </label>
              <p class="hint" id="model-hint">O Whisper fica neste Chrome. O áudio não sai do computador.</p>
              <div id="custom-fields" hidden>
                <label>Link
                  <input id="hf-repo" type="text" spellcheck="false" autocomplete="off" placeholder="huggingface.co/…/whisper-tiny" />
                </label>
              </div>
              <div id="motor-panel" hidden>
                <div class="split">
                  <div class="pill">
                    <i id="motor-dot" class="dot"></i>
                    <span id="motor-text">Bandeja</span>
                  </div>
                  <div class="pill">
                    <i id="model-dot" class="dot"></i>
                    <span id="model-text">Modelo</span>
                  </div>
                </div>
                <div class="meter" id="motor-meter" hidden><span id="motor-bar"></span></div>
                <p class="hint" id="motor-hint" hidden>
                  O Setup do zip instala uma vez. Depois use Ligar o motor (atalho na área de trabalho). A extensão só verifica se a bandeja responde — não baixa o .exe.
                </p>
              </div>
              <div class="meter" id="meter" hidden><span id="bar"></span></div>
              <div id="confirm" class="confirm" hidden>
                <p id="confirm-text"></p>
                <div class="actions">
                  <button class="act" id="confirm-yes" type="button">Baixar</button>
                  <button class="ghost" id="confirm-no" type="button">Agora não</button>
                </div>
              </div>
              <div class="actions">
                <button class="act" id="download" type="button">Baixar</button>
                <button class="ghost" id="reveal" type="button">Pasta</button>
              </div>
            </div>
            <label>Idioma
              <select id="language">
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="auto">Detectar</option>
              </select>
            </label>
            <p class="status">Português (e inglês/espanhol) descarta chinês, japonês e outros alfabetos que o modelo misturar.</p>
            <p class="status" id="save-status"></p>
            <div class="test">
              <p>Testar</p>
              <p class="drop">Solte um áudio ou escolha um arquivo.</p>
              <input id="file" type="file" accept="audio/*,.ogg,.opus,.mp3,.wav,.m4a,.webm" />
              <p class="status" id="test-status"></p>
              <div class="out" id="test-out" hidden></div>
            </div>
            <details class="help">
              <summary>Ajuda</summary>
              <dl>
                <dt>Extensão e motor</dt>
                <dd>A extensão é o botão no WhatsApp. O motor é o ícone na bandeja do Windows, ao lado do relógio. Whisper no Chrome não usa motor. Nemotron usa.</dd>
                <dt>Bandeja Ligado ou Desligado</dt>
                <dd>Verde: pode transcrever. Cinza: clique em Ligar. “Não instalado”: rode o Setup do zip, uma vez.</dd>
                <dt>Preciso do Setup de novo?</dt>
                <dd>Não, se só recarregou a extensão — transcrever segue. Sim, se o painel pedir Atualize, ou se quiser o modelo sair da memória depois do clique (PC com pouca RAM).</dd>
                <dt>Os dois pontos</dt>
                <dd>Bandeja = o programa. Modelo = o arquivo no disco. Sobe na memória só no clique e sai no fim.</dd>
              </dl>
            </details>
          </div>
        </aside>
      </div>`;

    document.documentElement.appendChild(host);
    bindPanel();
    return host;
  }

  function $p(id) {
    return shadow?.getElementById(id) || null;
  }

  function bindPanel() {
    $p("back")?.addEventListener("click", close);
    $p("close")?.addEventListener("click", close);
    $p("provider")?.addEventListener("change", () => {
      syncFields();
      void save();
      void refreshLocal();
    });
    $p("language")?.addEventListener("change", () => void save());
    $p("apiKey")?.addEventListener("change", () => void save());
    $p("model")?.addEventListener("change", () => void onModelChange());
    $p("hf-repo")?.addEventListener("change", () => void save());
    $p("download")?.addEventListener("click", () => void commitModel());
    $p("reveal")?.addEventListener("click", () => void revealFolder());
    $p("confirm-yes")?.addEventListener("click", () => {
      hideConfirm();
      void startDownload($p("model")?.value || "turbo");
    });
    $p("confirm-no")?.addEventListener("click", () => revertModel());
    $p("file")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) void testFile(file);
    });
    const test = $p("file")?.closest(".test");
    test?.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    test?.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) void testFile(file);
    });
  }

  function syncModelHint() {
    const hint = $p("model-hint");
    if (!hint) return;
    const kind = normalizeKind($p("model")?.value);
    hint.textContent = globalThis.VCShared.modelHint(kind);
    hint.hidden = false;
  }

  function syncFields() {
    const local = $p("provider")?.value === "local";
    const cloud = $p("cloud-fields");
    const box = $p("local-fields");
    if (cloud) cloud.hidden = Boolean(local);
    if (box) box.hidden = !local;
    syncModelFields();
    syncModelHint();
  }

  function syncModelFields() {
    const custom = $p("custom-fields");
    if (custom) custom.hidden = $p("model")?.value !== "custom";
  }

  // Parte 6: funções compartilhadas via shared.js (VCShared), carregado pelo
  // manifest antes deste content script — sem import, Chrome 116 ok.
  const normalizeKind = (k) => globalThis.VCShared.normalizeKind(k);
  const parseHfRepo = (r) => globalThis.VCShared.parseHfRepo(r);

  async function save() {
    await chrome.storage.local.set({
      provider: $p("provider")?.value || "local",
      apiKey: $p("apiKey")?.value.trim() || "",
      language: $p("language")?.value || "pt",
      customModelInput: $p("hf-repo")?.value.trim() || "",
    });
    const s = $p("save-status");
    if (s) {
      s.textContent = "Guardado.";
      s.className = "status ok";
    }
  }

  async function commitModel() {
    const download = $p("download");
    const action = download?.dataset.action || "download";
    if (action === "wait" || action === "ready") return;
    if (action === "wake") {
      void wakeMotor();
      return;
    }
    hideConfirm();
    void startDownload($p("model")?.value || "turbo", { switching: action === "switch" });
  }

  function hideConfirm() {
    const box = $p("confirm");
    if (box) box.hidden = true;
  }

  function showConfirm(kind) {
    const box = $p("confirm");
    const text = $p("confirm-text");
    const yes = $p("confirm-yes");
    const meta = metaOf(kind);
    if (!box || !text) return;
    text.textContent = `Baixar ${meta.name}${meta.size ? ` · ${meta.size}` : ""}?`;
    if (yes) yes.textContent = `Baixar ${meta.name}`;
    box.hidden = false;
    flashEl(box);
  }

  function revertModel() {
    if ($p("model")) $p("model").value = lastPreferred;
    hideConfirm();
    syncFields();
    void refreshLocal();
  }

  async function onModelChange() {
    syncModelFields();
    syncModelHint();
    hideConfirm();
    const kind = normalizeKind($p("model")?.value);
    lastPreferred = kind;
    await chrome.storage.local.set({ preferredKind: kind });
    const status = $p("local-status");
    if (status) {
      status.textContent = `Verificando ${metaOf(kind).name}…`;
      status.className = "status warn flash";
      flashEl(status);
    }
    if (kind === "nemotron") {
      paintLocal({ checking: true, kind: "nemotron" });
      void refreshLocal();
      return;
    }
    if (kind === "custom") {
      void refreshLocal();
      return;
    }
    try {
      const probe = await chrome.runtime.sendMessage({
        type: "VOZCLARA_MODEL_PROBE",
        kind,
        repo: $p("hf-repo")?.value.trim() || "",
      });
      if (probe?.cached && kind !== "nemotron") {
        lastPreferred = kind;
        void startDownload(kind, { switching: true });
        return;
      }
      showConfirm(kind);
      void refreshLocal();
    } catch {
      showConfirm(kind);
    }
  }

  async function loadForm() {
    const stored = await chrome.storage.local.get([
      "provider",
      "apiKey",
      "language",
      "localModelKind",
      "preferredKind",
      "customModelInput",
      "customModelRepo",
    ]);
    if ($p("provider")) $p("provider").value = stored.provider || "local";
    if ($p("apiKey")) $p("apiKey").value = stored.apiKey || "";
    if ($p("language")) $p("language").value = stored.language || "pt";
    if ($p("model")) {
      lastPreferred = normalizeKind(
        stored.preferredKind || stored.localModelKind || "turbo",
      );
      $p("model").value = lastPreferred;
    }
    if ($p("hf-repo")) {
      $p("hf-repo").value = stored.customModelInput || stored.customModelRepo || "";
    }
    syncFields();
    const kind = normalizeKind($p("model")?.value);
    if (kind === "nemotron") paintLocal({ checking: true, kind: "nemotron" });
    await refreshLocal();
  }

  function showQualityFallback() {
    const take = globalThis.VCShared?.takeQualityFallback;
    if (!take) return Promise.resolve();
    return take().then((entry) => {
      if (!entry?.label) return;
      const el = $p("local-status") || $p("save-status");
      if (!el) return;
      el.textContent = entry.label;
      el.className = "status warn";
    });
  }

  function watchMotor(state) {
    const selected = normalizeKind($p("model")?.value);
    const busy =
      selected === "nemotron" &&
      (Boolean(state?.checking) ||
        Boolean(state?.downloading) ||
        (Boolean(state?.motorAlive) && !state?.motorUp));
    if (busy && !motorPoll) {
      motorPoll = setInterval(() => void refreshLocal(), 700);
    } else if (!busy && motorPoll) {
      clearInterval(motorPoll);
      motorPoll = null;
    }
  }

  function paintLocal(state) {
    const status = $p("local-status");
    const meter = $p("meter");
    const bar = $p("bar");
    const download = $p("download");
    const reveal = $p("reveal");
    const ready = Boolean(state?.ready);
    const downloading = Boolean(state?.downloading);
    const percent = Number(state?.percent) || 0;
    const error = state?.error || "";
    const label = globalThis.VCShared.stateLabel(state);
    const selected = normalizeKind($p("model")?.value);
    const action = globalThis.VCShared.primaryAction(state, selected);
    const isNemo = selected === "nemotron";
    const motorPanel = $p("motor-panel");
    if (motorPanel) motorPanel.hidden = !isNemo;
    const motorHint = $p("motor-hint");
    if (motorHint) motorHint.hidden = !isNemo;
    if (isNemo) {
      const view = globalThis.VCShared.motorView(state);
      const motorText = $p("motor-text");
      const modelText = $p("model-text");
      const motorDot = $p("motor-dot");
      const modelDot = $p("model-dot");
      const motorMeter = $p("motor-meter");
      const motorBar = $p("motor-bar");
      if (motorText) motorText.textContent = view.motor.text;
      if (modelText) modelText.textContent = view.model.text;
      if (motorDot) motorDot.className = `dot ${view.motor.kind || "off"}`;
      if (modelDot) modelDot.className = `dot ${view.model.kind || "off"}`;
      if (motorMeter && motorBar) {
        const show =
          Boolean(state?.motorAlive) &&
          !state?.motorUp &&
          (view.model.percent > 0 || view.model.indeterminate);
        motorMeter.hidden = !show;
        motorMeter.classList.toggle("indeterminate", Boolean(view.model.indeterminate));
        motorBar.style.width = `${Math.max(0, Math.min(100, view.model.percent || 8))}%`;
      }
      if (status) {
        status.textContent = globalThis.VCShared.motorHeadline(state);
        status.className = error ? "warn" : state?.motorUp ? "ok" : "warn";
        status.dataset.kind = error ? "warn" : state?.motorUp ? "ok" : "warn";
      }
      if (meter) meter.hidden = true;
    } else if (status) {
      status.textContent = error || label;
      status.className =
        error ? "warn" : action.id === "ready" ? "ok" : downloading ? "warn" : "";
    }
    if (meter && bar && !isNemo) {
      const show = downloading || (percent > 0 && percent < 100 && !ready);
      meter.hidden = !show;
      bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    if (download) {
      download.disabled = action.disabled;
      download.dataset.action = action.id;
      download.textContent = action.label;
    }
    if (reveal) {
      reveal.hidden = isNemo || action.id !== "ready";
      reveal.disabled = downloading || action.id !== "ready";
    }
    if (action.id === "ready" && !isNemo) {
      chrome.storage.local.set({ preferredKind: selected }).catch(() => {});
    }
    watchMotor(state);
    paintDot(document.getElementById(BTN_ID));
  }

  async function refreshLocal(opts) {
    const selected = normalizeKind($p("model")?.value);
    try {
      const state = await chrome.runtime.sendMessage(
        globalThis.VCShared.verifyRequest(selected),
      );
      if (state && typeof state === "object" && state.checked) {
        paintLocal(state);
        void showQualityFallback();
        return;
      }
    } catch {
      /* storage */
    }
    const stored = await chrome.storage.local.get(globalThis.VCShared.FALLBACK_KEYS);
    paintLocal(globalThis.VCShared.fallbackLocalState(stored));
    void showQualityFallback();
  }

  async function wakeMotor() {
    const s = $p("save-status");
    if (s) {
      s.textContent = "Ligando o motor na bandeja, ao lado do relógio…";
      s.className = "status warn";
    }
    try {
      window.open("vozclara://run", "_blank", "noopener");
    } catch {
      /* ignore */
    }
    try {
      await chrome.runtime.sendMessage({ type: "VOZCLARA_MOTOR_WAKE" });
    } catch {
      /* ignore */
    }
    await refreshLocal();
  }

  async function startDownload(kind, opts = {}) {
    const want = normalizeKind(kind);
    const repo = want === "custom" ? ($p("hf-repo")?.value.trim() || "") : "";
    const parsed = parseHfRepo(repo);
    const meta = metaOf(want);
    if (want === "custom" && /nemotron|parakeet|fastconformer|canary|nemo[-_]?asr/i.test(parsed)) {
      const s = $p("save-status");
      if (s) {
        s.textContent =
          "Escolha Nemotron no seletor. O Setup já veio no zip — não baixa de novo.";
        s.className = "status warn";
      }
      return;
    }
    hideConfirm();
    lastPreferred = want;
    paintLocal({
      downloading: !opts.switching,
      ready: Boolean(opts.switching),
      percent: opts.switching ? 70 : 1,
      kind: want,
      label: opts.switching
        ? `Trocando para ${meta.name}…`
        : globalThis.VCShared.downloadLabel(want, repo),
    });
    await chrome.storage.local.set({
      provider: "local",
      customModelInput: repo,
      preferredKind: want,
    });
    if ($p("provider")) $p("provider").value = "local";
    syncFields();
    try {
      await chrome.runtime.sendMessage({
        type: "VOZCLARA_MODEL_DOWNLOAD",
        kind: want,
        repo: parseHfRepo(repo),
      });
      const s = $p("save-status");
      if (s) {
        s.textContent = opts.switching
          ? `${meta.name} já estava aqui. Aplicando…`
          : want === "nemotron"
            ? "Se o motor não responder, rode o Setup do zip e clique de novo em Verificar."
            : "Deixe a aba aberta até Pronto. Pode fechar este painel.";
        s.className = want === "nemotron" && !opts.switching ? "status warn" : "status ok";
        flashEl(s);
      }
    } catch (err) {
      paintLocal({
        downloading: false,
        ready: false,
        error: err instanceof Error ? err.message : "Não iniciou o download.",
      });
    } finally {
      void refreshLocal();
    }
  }

  async function revealFolder() {
    try {
      await chrome.runtime.sendMessage({ type: "VOZCLARA_MODEL_REVEAL" });
    } catch {
      /* ignore */
    }
  }

  async function testFile(file) {
    const status = $p("test-status");
    const out = $p("test-out");
    if (status) {
      status.textContent = `Transcrevendo ${file.name}…`;
      status.className = "status warn";
    }
    if (out) {
      out.hidden = true;
      out.textContent = "";
    }
    try {
      const audioBuffer = await file.arrayBuffer();
      const audioBase64 = (() => {
        const u8 = new Uint8Array(audioBuffer);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < u8.length; i += chunk) {
          binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        return btoa(binary);
      })();
      const result = await chrome.runtime.sendMessage({
        type: "VOZCLARA_STT",
        audioBase64,
        mimeType: file.type || "audio/ogg",
        fileName: file.name,
        byteLength: audioBuffer.byteLength,
      });
      if (!result?.ok) throw new Error(result?.error || "Falha ao transcrever.");
      if (status) {
        status.textContent = "Pronto.";
        status.className = "status ok";
      }
      if (out) {
        out.hidden = false;
        out.textContent = result.text;
      }
    } catch (err) {
      if (status) {
        status.textContent = err instanceof Error ? err.message : "Falha no teste.";
        status.className = "status warn";
      }
    }
  }

  function open() {
    layerRoot();
    const layer = $p("layer");
    if (!layer) return;
    layer.classList.toggle("dark", isDark());
    layer.classList.toggle("light", !isDark());
    syncFields();
    layer.classList.add("open");
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.setAttribute("aria-pressed", "true");
      btn.style.background = "rgba(0,168,132,.16)";
    }
    void loadForm();
  }

  function close() {
    $p("layer")?.classList.remove("open");
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.style.background = "transparent";
    }
  }

  function toggle() {
    const openNow = $p("layer")?.classList.contains("open");
    if (openNow) close();
    else open();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $p("layer")?.classList.contains("open")) close();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (
      changes.localProgress ||
      changes.localModelReady ||
      changes.localModelId ||
      changes.cachedKinds ||
      changes.motorAlive ||
      changes.motorUp ||
      changes.motorInstalled
    ) {
      if ($p("layer")?.classList.contains("open")) void refreshLocal();
      paintDot(document.getElementById(BTN_ID));
    }
  });

  function boot() {
    ensureButton();
    window.setInterval(() => {
      if (normalizeKind($p("model")?.value) === "nemotron") void refreshLocal();
    }, 8000);
    const obs = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        ensureButton();
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
