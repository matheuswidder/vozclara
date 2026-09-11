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
    .layer {
      position: fixed; inset: 0; z-index: 2147483000;
      display: none;
    }
    .layer.open { display: block; }
    .back {
      position: absolute; inset: 0;
      background: rgba(11, 20, 26, .32);
    }
    .sheet {
      position: absolute;
      top: 10px; bottom: 10px;
      left: 68px;
      width: min(380px, calc(100vw - 84px));
      background: var(--bg);
      color: var(--fg);
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,.28);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 14px 12px;
      border-bottom: 1px solid var(--line);
    }
    .mark {
      width: 34px; height: 34px; border-radius: 10px;
      background: #0b3d32;
      background-image:
        linear-gradient(#5dcaa0,#5dcaa0),
        linear-gradient(#5dcaa0,#5dcaa0),
        linear-gradient(#5dcaa0,#5dcaa0),
        linear-gradient(#5dcaa0,#5dcaa0),
        linear-gradient(#5dcaa0,#5dcaa0);
      background-size: 3px 10px, 3px 16px, 3px 20px, 3px 12px, 3px 8px;
      background-position: 7px 12px, 12px 9px, 17px 7px, 22px 11px, 27px 13px;
      background-repeat: no-repeat; flex: 0 0 auto;
    }
    header strong { display: block; font-size: 16px; }
    header p { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
    .x {
      margin-left: auto; border: 0; background: transparent;
      color: var(--muted); width: 32px; height: 32px; border-radius: 50%;
      cursor: pointer; font-size: 20px; line-height: 1;
    }
    .x:hover { background: var(--hover); color: var(--fg); }
    .body { padding: 14px; overflow: auto; flex: 1; }
    label { display: flex; flex-direction: column; gap: 6px; margin: 0 0 12px;
      font-size: 12px; font-weight: 600; }
    select, input[type="password"], input[type="text"] {
      appearance: none; border: 1px solid var(--line); background: var(--field);
      color: var(--fg); border-radius: 10px; padding: 9px 10px; font-size: 13px;
    }
    .row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 12px; }
    .actions {
      display: flex; gap: 8px; margin: 8px 0 14px;
    }
    .actions button {
      flex: 1; min-width: 0;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .actions svg { flex: 0 0 auto; }
    button.act {
      border: 0; background: #00a884; color: #062016;
      font-weight: 700; border-radius: 10px; padding: 9px 10px; cursor: pointer;
      font-size: 12.5px;
    }
    button.act:disabled { opacity: .55; cursor: default; }
    button.ghost {
      border: 1px solid var(--line); background: transparent; color: var(--fg);
      border-radius: 10px; padding: 9px 12px; cursor: pointer; font-size: 13px;
    }
    .meter { height: 6px; background: var(--line); border-radius: 99px; overflow: hidden; margin: 0 0 8px; }
    .meter span { display: block; height: 100%; width: 0; background: #00a884; }
    .status { margin: 0 0 10px; font-size: 12.5px; color: var(--muted); }
    .status.ok { color: #1fa855; }
    .status.warn { color: #c47f17; }
    .hint { font-size: 12px; color: var(--muted); margin: 0 0 12px; font-weight: 400; }
    .test {
      border: 1px dashed var(--line); border-radius: 12px; padding: 12px;
      background: var(--field);
    }
    .test p { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
    .test .drop {
      font-size: 12px; color: var(--muted); margin: 0 0 8px; font-weight: 400;
    }
    .out {
      margin: 10px 0 0; padding: 10px; border-radius: 10px;
      background: var(--bg); font-size: 13px; line-height: 1.4; white-space: pre-wrap;
    }
    .light { --bg:#fff; --fg:#111b21; --muted:#667781; --line:#e9edef; --field:#f0f2f5; --hover:#f0f2f5; }
    .dark { --bg:#202c33; --fg:#e9edef; --muted:#8696a0; --line:#3b4a54; --field:#111b21; --hover:#2a3942; }
  `;

  let shadow = null;
  let raf = 0;

  function isDark() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (!m || m.length < 3) return false;
    const [r, g, b] = m.map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000 < 90;
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
      ]);
      const downloading = Boolean(stored.localProgress?.downloading);
      const ready = Boolean(stored.localModelReady);
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
              <p>Configurar e testar neste WhatsApp</p>
            </div>
            <button class="x" id="close" type="button" aria-label="Fechar">×</button>
          </header>
          <div class="body">
            <p class="status" id="local-status">Checando o Whisper…</p>
            <div class="meter" id="meter" hidden><span id="bar"></span></div>
            <label>Provedor
              <select id="provider">
                <option value="local">Whisper neste Chrome (offline)</option>
                <option value="openai">OpenAI (Whisper)</option>
                <option value="gemini">Google Gemini</option>
                <option value="groq">Groq (Whisper)</option>
                <option value="xai">xAI (Grok STT)</option>
              </select>
            </label>
            <div id="cloud-fields">
              <label>Chave de API
                <input id="apiKey" type="password" spellcheck="false" autocomplete="off" placeholder="Cole a chave" />
              </label>
            </div>
            <div id="local-fields">
              <p class="hint">O modelo fica neste navegador. O áudio não sai da máquina.</p>
              <label>Modelo
                <select id="model">
                  <option value="turbo">v3 turbo — Whisper, neste Chrome (~560 MB)</option>
                  <option value="v3">v3 — Whisper, neste Chrome (~1,5 GB)</option>
                  <option value="light">small — Whisper leve (~120 MB)</option>
                  <option value="tiny">tiny — Whisper OpenAI (~40 MB)</option>
                  <option value="nemotron">Nemotron 3.5 ASR 0.6B — NVIDIA (instalador Windows)</option>
                  <option value="custom">Outro Whisper (colar link do Hugging Face)</option>
                </select>
              </label>
              <div id="custom-fields" hidden>
                <label>Link do modelo
                  <input id="hf-repo" type="text" spellcheck="false" autocomplete="off" placeholder="https://huggingface.co/openai/whisper-tiny" />
                </label>
                <p class="hint">Só Whisper ONNX neste Chrome. Nemotron instala um programa no Windows — a extensão baixa o VozClara-Motor-Setup.exe.</p>
              </div>
              <div class="actions">
                <button class="act" id="download" type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
                  Baixar
                </button>
                <button class="ghost" id="reveal" type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7h6l2 2h10v10H3z"/></svg>
                  Pasta
                </button>
                <button class="ghost" id="apply" type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l5 5L20 7"/></svg>
                  Aplicar
                </button>
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
            <p class="status" id="save-status"></p>
            <p class="hint" id="reload-hint" hidden>Recarregue o WhatsApp (F5) para aplicar.</p>
            <div class="test">
              <p>Testar</p>
              <p class="drop">Solte um áudio aqui ou escolha um arquivo. Não usa o WhatsApp — só para ver se o Whisper está ok.</p>
              <input id="file" type="file" accept="audio/*,.ogg,.opus,.mp3,.wav,.m4a,.webm" />
              <p class="status" id="test-status"></p>
              <div class="out" id="test-out" hidden></div>
            </div>
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
    $p("model")?.addEventListener("change", () => {
      syncModelFields();
      void refreshLocal();
    });
    $p("hf-repo")?.addEventListener("change", () => void save());
    $p("download")?.addEventListener("click", () => {
      if ($p("download")?.dataset.wake === "1") {
        void wakeMotor();
        return;
      }
      void startDownload($p("model")?.value || "turbo");
    });
    $p("reveal")?.addEventListener("click", () => void revealFolder());
    $p("apply")?.addEventListener("click", () => void apply());
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

  function syncFields() {
    const local = $p("provider")?.value === "local";
    const cloud = $p("cloud-fields");
    const box = $p("local-fields");
    if (cloud) cloud.hidden = Boolean(local);
    if (box) box.hidden = !local;
    syncModelFields();
  }

  function syncModelFields() {
    const custom = $p("custom-fields");
    if (custom) custom.hidden = $p("model")?.value !== "custom";
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

  function normalizeKind(kind) {
    const k = String(kind || "").toLowerCase();
    if (k === "v3" || k === "precise" || k === "large" || k === "large-v3") return "v3";
    if (k === "light" || k === "small") return "light";
    if (k === "tiny") return "tiny";
    if (k === "nemotron") return "nemotron";
    if (k === "custom") return "custom";
    return "turbo";
  }

  async function save() {
    await chrome.storage.local.set({
      provider: $p("provider")?.value || "local",
      apiKey: $p("apiKey")?.value.trim() || "",
      language: $p("language")?.value || "pt",
      preferredKind: normalizeKind($p("model")?.value),
      customModelInput: $p("hf-repo")?.value.trim() || "",
    });
    const s = $p("save-status");
    if (s) {
      s.textContent = "Guardado.";
      s.className = "status ok";
    }
  }

  async function apply() {
    await save();
    const kind = normalizeKind($p("model")?.value);
    const stored = await chrome.storage.local.get(["localModelKind", "localModelReady", "customModelRepo"]);
    const hint = $p("reload-hint");
    if (hint) hint.hidden = false;
    const s = $p("save-status");
    if (s) {
      s.textContent = "Aplicado. Recarregue o WhatsApp (F5) para valer.";
      s.className = "status ok";
    }
    const sameRepo =
      kind !== "custom" ||
      parseHfRepo($p("hf-repo")?.value) === parseHfRepo(stored.customModelRepo);
    if (!stored.localModelReady || normalizeKind(stored.localModelKind) !== kind || !sameRepo) {
      void startDownload(kind);
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
      $p("model").value = normalizeKind(
        stored.preferredKind || stored.localModelKind || "turbo",
      );
    }
    if ($p("hf-repo")) {
      $p("hf-repo").value = stored.customModelInput || stored.customModelRepo || "";
    }
    syncFields();
    await refreshLocal();
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
    const label =
      state?.label ||
      (ready ? `Pronto · ${state.model || "Whisper"}` : "Ainda não baixou o Whisper.");
    if (status) {
      status.textContent = error || label;
      status.className = "status " + (error ? "warn" : ready ? "ok" : downloading ? "warn" : "");
    }
    if (meter && bar) {
      const show = downloading || (percent > 0 && percent < 100 && !ready);
      meter.hidden = !show;
      bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    const selected = normalizeKind($p("model")?.value);
    const installed = normalizeKind(state?.kind);
    const motorUp = Boolean(state?.motorUp);
    const motorAlive = Boolean(state?.motorAlive);
    const motorInstalled = Boolean(state?.motorInstalled) || motorUp || motorAlive;
    if (download) {
      download.disabled = downloading;
      download.dataset.wake = selected === "nemotron" && motorInstalled && !motorUp && !motorAlive ? "1" : selected === "nemotron" && motorInstalled && !motorUp ? "1" : "";
      download.innerHTML = downloading || (selected === "nemotron" && motorAlive && !motorUp)
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg> Carregando…`
        : selected === "nemotron" && motorUp
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l5 5L20 7"/></svg> Na bandeja`
          : selected === "nemotron" && motorInstalled
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Ligar motor`
            : selected === "nemotron"
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg> Instalar no PC`
              : ready && selected === installed
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l5 5L20 7"/></svg> Pronto`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg> Baixar`;
    }
    if (reveal) reveal.disabled = downloading || !ready;
    paintDot(document.getElementById(BTN_ID));
  }

  async function refreshLocal() {
    try {
      const state = await chrome.runtime.sendMessage({ type: "VOZCLARA_MODEL_VERIFY" });
      if (state && typeof state === "object") {
        paintLocal(state);
        return;
      }
    } catch {
      /* storage */
    }
    const stored = await chrome.storage.local.get([
      "localModelReady",
      "localModelId",
      "localModelKind",
      "localProgress",
    ]);
    paintLocal({
      ready: Boolean(stored.localModelReady),
      downloading: Boolean(stored.localProgress?.downloading),
      percent: stored.localProgress?.percent || (stored.localModelReady ? 100 : 0),
      label: stored.localProgress?.label,
      error: stored.localProgress?.error,
      model: stored.localModelId,
      kind: stored.localModelKind,
    });
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

  async function startDownload(kind) {
    const want = normalizeKind(kind);
    const repo = want === "custom" ? ($p("hf-repo")?.value.trim() || "") : "";
    const parsed = parseHfRepo(repo);
    if (want === "custom" && /nemotron|parakeet|fastconformer|canary|nemo[-_]?asr/i.test(parsed)) {
      const s = $p("save-status");
      if (s) {
        s.textContent =
          "Escolha Nemotron no seletor. A extensão baixa o instalador do PC.";
        s.className = "status warn";
      }
      return;
    }
    paintLocal({
      downloading: true,
      ready: false,
      percent: 1,
      kind: want,
      label:
        want === "nemotron"
          ? "Baixando o instalador do motor…"
          : want === "custom"
          ? `Baixando ${parseHfRepo(repo)}…`
          : want === "tiny"
            ? "Baixando o tiny…"
            : want === "light"
              ? "Baixando a versão leve…"
              : want === "v3"
                ? "Baixando o v3…"
                : "Abrindo o download…",
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
        s.textContent = "Download numa aba da extensão. Deixe-a aberta até Pronto.";
        s.className = "status ok";
      }
    } catch (err) {
      paintLocal({
        downloading: false,
        ready: false,
        error: err instanceof Error ? err.message : "Não iniciou o download.",
      });
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
    if (changes.localProgress || changes.localModelReady || changes.localModelId) {
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
