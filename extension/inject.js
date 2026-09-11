(() => {
  if (window.__vozclaraHooks) return;
  window.__vozclaraHooks = true;

  let silent = false;
  const saved = new WeakMap();

  function isSilent() {
    return (
      silent ||
      document.documentElement.getAttribute("data-vozclara-silent") === "1"
    );
  }

  function hush(media) {
    if (!(media instanceof HTMLMediaElement)) return;
    if (!saved.has(media)) {
      saved.set(media, {
        muted: media.muted,
        volume: media.volume,
        defaultMuted: media.defaultMuted,
        rate: media.playbackRate,
      });
    }
    try {
      media.muted = true;
      media.defaultMuted = true;
      media.volume = 0;
      media.playbackRate = 16;
    } catch {
      /* ignore */
    }
  }

  function restore(media) {
    if (!(media instanceof HTMLMediaElement)) return;
    const s = saved.get(media);
    try {
      if (s) {
        media.muted = s.muted;
        media.defaultMuted = s.defaultMuted;
        media.volume = s.volume > 0 ? s.volume : 1;
        media.playbackRate = s.rate || 1;
      } else {
        media.muted = false;
        media.defaultMuted = false;
        if (media.volume === 0) media.volume = 1;
        media.playbackRate = 1;
      }
    } catch {
      /* ignore */
    }
    saved.delete(media);
  }

  function restoreAll() {
    document.querySelectorAll("audio, video").forEach((m) => restore(m));
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.source !== "vozclara") return;
    if (data.type === "silent") {
      silent = Boolean(data.on);
      if (!silent) restoreAll();
    }
    if (data.type === "restore") restoreAll();
    if (data.type === "fetch-src" && typeof data.src === "string") {
      fetch(data.src)
        .then((r) => r.blob())
        .then(async (blob) => {
          if (!(blob instanceof Blob) || blob.size < 64) {
            window.postMessage(
              {
                source: "vozclara",
                type: "fetch-fail",
                requestId: data.requestId,
                error: "blob vazio",
              },
              "*",
            );
            return;
          }
          const buffer = await blob.arrayBuffer();
          window.postMessage(
            {
              source: "vozclara",
              type: "media",
              reason: "fetch-src",
              requestId: data.requestId,
              mime: blob.type || "audio/ogg",
              size: blob.size,
              buffer,
            },
            "*",
          );
        })
        .catch((err) => {
          window.postMessage(
            {
              source: "vozclara",
              type: "fetch-fail",
              requestId: data.requestId,
              error: err instanceof Error ? err.message : "fetch falhou",
            },
            "*",
          );
        });
    }
  });

  function emitBlob(blob, reason) {
    if (!(blob instanceof Blob) || blob.size < 256) return;
    const mime = blob.type || "audio/ogg";
    if (mime && !/audio|ogg|opus|mpeg|mp4|webm|octet|empty/i.test(mime) && mime.length > 0) {
      if (!/audio/i.test(mime)) return;
    }
    blob
      .arrayBuffer()
      .then((buffer) => {
        window.postMessage(
          {
            source: "vozclara",
            type: "media",
            reason,
            mime: /audio/i.test(mime) ? mime : "audio/ogg",
            size: blob.size,
            buffer,
          },
          "*",
        );
      })
      .catch(() => {});
  }

  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    const url = origCreate(obj);
    if (obj instanceof Blob) emitBlob(obj, "createObjectURL");
    return url;
  };

  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (isSilent()) hush(this);
    const result = origPlay.apply(this, args);
    if (isSilent()) {
      hush(this);
      const keepQuiet = () => hush(this);
      queueMicrotask(keepQuiet);
      requestAnimationFrame(keepQuiet);
    }
    return result;
  };

  const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
  if (srcDesc?.set && srcDesc?.get) {
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      enumerable: srcDesc.enumerable,
      get() {
        return srcDesc.get.call(this);
      },
      set(value) {
        if (isSilent()) hush(this);
        if (typeof value === "string" && value.startsWith("blob:")) {
          fetch(value)
            .then((r) => r.blob())
            .then((b) => emitBlob(b, "src"))
            .catch(() => {});
        }
        return srcDesc.set.call(this, value);
      },
    });
  }

  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    const out = origSetAttr.apply(this, arguments);
    if (
      this instanceof HTMLMediaElement &&
      String(name).toLowerCase() === "src" &&
      typeof value === "string" &&
      value.startsWith("blob:")
    ) {
      fetch(value)
        .then((r) => r.blob())
        .then((b) => emitBlob(b, "setAttribute"))
        .catch(() => {});
    }
    return out;
  };

  document.addEventListener(
    "play",
    (e) => {
      if (!isSilent()) return;
      if (e.target instanceof HTMLMediaElement) hush(e.target);
    },
    true,
  );

  function patchDecode(Ctx) {
    if (!Ctx?.prototype?.decodeAudioData) return;
    const orig = Ctx.prototype.decodeAudioData;
    Ctx.prototype.decodeAudioData = function (buffer, ...rest) {
      if (isSilent() && buffer instanceof ArrayBuffer && buffer.byteLength > 2048) {
        emitBlob(new Blob([buffer.slice(0)], { type: "audio/ogg" }), "decode");
      }
      return orig.apply(this, [buffer, ...rest]);
    };
  }
  patchDecode(window.AudioContext);
  patchDecode(window.webkitAudioContext);
})();
