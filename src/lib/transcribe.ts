import { createServerFn } from "@tanstack/react-start";
import type { LanguageId, ProviderId } from "./providers";

const MAX_BYTES = 3 * 1024 * 1024;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_DEMO_HITS = 8;
const hits = new Map<string, number[]>();

export type TranscribeInput = {
  audioBase64: string;
  mimeType: string;
  fileName?: string;
  provider: ProviderId;
  apiKey?: string;
  language?: LanguageId;
  sessionId?: string;
};

export type TranscribeResult =
  | { ok: true; text: string; provider: ProviderId }
  | { ok: false; error: string };

function allowDemo(sessionId: string) {
  const now = Date.now();
  const prev = (hits.get(sessionId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX_DEMO_HITS) return false;
  prev.push(now);
  hits.set(sessionId, prev);
  return true;
}

function mimeToName(mime: string, fallback: string) {
  if (mime.includes("ogg") || mime.includes("opus")) return "voice.ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "voice.mp3";
  if (mime.includes("wav")) return "voice.wav";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac"))
    return "voice.m4a";
  if (mime.includes("webm")) return "voice.webm";
  if (mime.includes("flac")) return "voice.flac";
  return fallback;
}

function languageParam(lang?: LanguageId) {
  if (!lang || lang === "auto") return "";
  return lang;
}

function asText(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const rec = body as Record<string, unknown>;
  if (typeof rec.text === "string") return rec.text.trim();
  return "";
}

async function transcribeOpenAI(
  bytes: Buffer,
  mime: string,
  fileName: string,
  apiKey: string,
  language: string,
) {
  const models = ["gpt-4o-mini-transcribe", "whisper-1"];
  let last = "OpenAI recusou a transcrição.";
  for (const model of models) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
    form.append("model", model);
    if (language) form.append("language", language);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (res.ok) {
      const text = asText(json);
      if (text) return text;
      last = "A OpenAI devolveu uma transcrição vazia.";
      continue;
    }
    const err = json as { error?: { message?: string } } | null;
    last = err?.error?.message ?? `OpenAI ${res.status}`;
  }
  throw new Error(last);
}

async function transcribeGroq(
  bytes: Buffer,
  mime: string,
  fileName: string,
  apiKey: string,
  language: string,
) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
  form.append("model", "whisper-large-v3");
  if (language) form.append("language", language);
  form.append("response_format", "json");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = json as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? `Groq ${res.status}`);
  }
  const text = asText(json);
  if (!text) throw new Error("A Groq devolveu uma transcrição vazia.");
  return text;
}

async function transcribeXai(
  bytes: Buffer,
  mime: string,
  fileName: string,
  apiKey: string,
  language: string,
) {
  const form = new FormData();
  if (language) form.append("language", language);
  form.append("format", "true");
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = json as { error?: string | { message?: string } } | null;
    const msg =
      typeof err?.error === "string"
        ? err.error
        : err?.error && typeof err.error === "object"
          ? err.error.message
          : `xAI ${res.status}`;
    throw new Error(msg ?? `xAI ${res.status}`);
  }
  const text = asText(json);
  if (!text) throw new Error("A xAI devolveu uma transcrição vazia.");
  return text;
}

async function transcribeGemini(
  bytes: Buffer,
  mime: string,
  apiKey: string,
  language: string,
) {
  const prompt = language
    ? `Transcreva este áudio fielmente. Idioma: ${language === "pt" ? "português brasileiro" : language}. Responda apenas com a transcrição, sem aspas nem comentários.`
    : "Transcreva este áudio fielmente. Responda apenas com a transcrição, sem aspas nem comentários.";
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let last = "Gemini recusou a transcrição.";
  const b64 = bytes.toString("base64");
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mime || "audio/mpeg", data: b64 } },
              ],
            },
          ],
        }),
      },
    );
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } | null;
    if (res.ok) {
      const text = json?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim();
      if (text) return text;
      last = "O Gemini devolveu uma transcrição vazia.";
      continue;
    }
    last = json?.error?.message ?? `Gemini ${res.status}`;
  }
  throw new Error(last);
}

export const transcribeAudio = createServerFn({ method: "POST" })
  .validator((input: TranscribeInput) => input)
  .handler(async ({ data }): Promise<TranscribeResult> => {
    const mime = data.mimeType || "application/octet-stream";
    const fileName = mimeToName(mime, data.fileName || "voice.ogg");
    const language = languageParam(data.language);
    const ownKey = data.apiKey?.trim() ?? "";

    let bytes: Buffer;
    try {
      bytes = Buffer.from(data.audioBase64, "base64");
    } catch {
      return { ok: false, error: "Áudio inválido." };
    }
    if (!bytes.length) return { ok: false, error: "O áudio está vazio." };
    if (bytes.length > MAX_BYTES) {
      return { ok: false, error: "Áudio grande demais (máx. 3 MB)." };
    }

    if (data.provider === "local") {
      return {
        ok: false,
        error:
          "O Whisper local roda na extensão. Aqui no site, escolha um provedor de nuvem.",
      };
    }

    const usingPlatformKey = data.provider === "xai" && !ownKey;
    const apiKey = usingPlatformKey ? process.env.XAI_API_KEY : ownKey;

    if (usingPlatformKey) {
      if (!apiKey) {
        return {
          ok: false,
          error: "Cole uma chave de API em Chaves para transcrever.",
        };
      }
      const sid = data.sessionId?.trim() || "anon";
      if (!allowDemo(sid)) {
        return {
          ok: false,
          error:
            "Limite do modo demonstração. Cole a sua chave da OpenAI, Gemini, Groq ou xAI para continuar.",
        };
      }
    } else if (!apiKey) {
      return {
        ok: false,
        error: "Cole a chave de API desse provedor em Chaves.",
      };
    }

    try {
      let text = "";
      if (data.provider === "openai") {
        text = await transcribeOpenAI(bytes, mime, fileName, apiKey, language);
      } else if (data.provider === "groq") {
        text = await transcribeGroq(bytes, mime, fileName, apiKey, language);
      } else if (data.provider === "gemini") {
        text = await transcribeGemini(bytes, mime, apiKey, language);
      } else {
        text = await transcribeXai(bytes, mime, fileName, apiKey, language);
      }
      return { ok: true, text, provider: data.provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao transcrever.";
      return { ok: false, error: message };
    }
  });
