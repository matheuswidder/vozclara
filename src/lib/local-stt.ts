import { DEFAULT_LOCAL_URL } from "./providers";

function baseUrl(url?: string) {
  const raw = (url || DEFAULT_LOCAL_URL).trim() || DEFAULT_LOCAL_URL;
  return raw.replace(/\/+$/, "");
}

function asText(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const rec = body as Record<string, unknown>;
  if (typeof rec.text === "string") return rec.text.trim();
  return "";
}

export type LocalHealth =
  | { ok: true; model?: string; ready?: boolean; engine?: string }
  | { ok: false; error: string };

export async function probeLocal(url?: string): Promise<LocalHealth> {
  const root = baseUrl(url);
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 1800);
  try {
    const res = await fetch(`${root}/health`, { signal: ctrl.signal });
    const json = (await res.json().catch(() => null)) as {
      model?: string;
      ready?: boolean;
      engine?: string;
      error?: string;
    } | null;
    if (!res.ok) {
      return { ok: false, error: json?.error || `Motor local ${res.status}` };
    }
    return {
      ok: true,
      model: json?.model,
      ready: json?.ready !== false,
      engine: json?.engine,
    };
  } catch {
    return {
      ok: false,
      error:
        "Motor local desligado. Extraia vozclara-local do zip e abra o atalho de iniciar.",
    };
  } finally {
    window.clearTimeout(t);
  }
}

export async function transcribeLocal(opts: {
  url?: string;
  blob: Blob;
  fileName: string;
  language?: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const root = baseUrl(opts.url);
  const form = new FormData();
  form.append(
    "file",
    opts.blob,
    opts.fileName || "voice.ogg",
  );
  if (opts.language && opts.language !== "auto") {
    form.append("language", opts.language);
  }

  const paths = ["/v1/audio/transcriptions", "/inference"];
  let last = "Motor local não respondeu.";
  for (const path of paths) {
    try {
      const res = await fetch(`${root}${path}`, { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as unknown;
      if (res.ok) {
        const text = asText(json);
        if (text) return { ok: true, text };
        last = "O Whisper local devolveu uma transcrição vazia.";
        continue;
      }
      const err = json as { error?: string | { message?: string } } | null;
      last =
        typeof err?.error === "string"
          ? err.error
          : err?.error && typeof err.error === "object"
            ? err.error.message || last
            : `Motor local ${res.status}`;
    } catch {
      last =
        "Não alcancei o Whisper local. Ligue o motor VozClara Local neste computador.";
    }
  }
  return { ok: false, error: last };
}
