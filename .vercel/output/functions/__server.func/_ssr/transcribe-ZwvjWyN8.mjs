import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/transcribe-ZwvjWyN8.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var MAX_BYTES = 3145728;
var WINDOW_MS = 9e5;
var MAX_DEMO_HITS = 8;
var hits = /* @__PURE__ */ new Map();
function allowDemo(sessionId) {
	const now = Date.now();
	const prev = (hits.get(sessionId) ?? []).filter((t) => now - t < WINDOW_MS);
	if (prev.length >= MAX_DEMO_HITS) return false;
	prev.push(now);
	hits.set(sessionId, prev);
	return true;
}
function mimeToName(mime, fallback) {
	if (mime.includes("ogg") || mime.includes("opus")) return "voice.ogg";
	if (mime.includes("mpeg") || mime.includes("mp3")) return "voice.mp3";
	if (mime.includes("wav")) return "voice.wav";
	if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "voice.m4a";
	if (mime.includes("webm")) return "voice.webm";
	if (mime.includes("flac")) return "voice.flac";
	return fallback;
}
function languageParam(lang) {
	if (!lang || lang === "auto") return "";
	return lang;
}
function asText(body) {
	if (!body || typeof body !== "object") return "";
	const rec = body;
	if (typeof rec.text === "string") return rec.text.trim();
	return "";
}
async function transcribeOpenAI(bytes, mime, fileName, apiKey, language) {
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
			body: form
		});
		const json = await res.json().catch(() => null);
		if (res.ok) {
			const text = asText(json);
			if (text) return text;
			last = "A OpenAI devolveu uma transcrição vazia.";
			continue;
		}
		last = json?.error?.message ?? `OpenAI ${res.status}`;
	}
	throw new Error(last);
}
async function transcribeGroq(bytes, mime, fileName, apiKey, language) {
	const form = new FormData();
	form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
	form.append("model", "whisper-large-v3");
	if (language) form.append("language", language);
	form.append("response_format", "json");
	const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}` },
		body: form
	});
	const json = await res.json().catch(() => null);
	if (!res.ok) throw new Error(json?.error?.message ?? `Groq ${res.status}`);
	const text = asText(json);
	if (!text) throw new Error("A Groq devolveu uma transcrição vazia.");
	return text;
}
async function transcribeXai(bytes, mime, fileName, apiKey, language) {
	const form = new FormData();
	if (language) form.append("language", language);
	form.append("format", "true");
	form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), fileName);
	const res = await fetch("https://api.x.ai/v1/stt", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}` },
		body: form
	});
	const json = await res.json().catch(() => null);
	if (!res.ok) {
		const err = json;
		const msg = typeof err?.error === "string" ? err.error : err?.error && typeof err.error === "object" ? err.error.message : `xAI ${res.status}`;
		throw new Error(msg ?? `xAI ${res.status}`);
	}
	const text = asText(json);
	if (!text) throw new Error("A xAI devolveu uma transcrição vazia.");
	return text;
}
async function transcribeGemini(bytes, mime, apiKey, language) {
	const prompt = language ? `Transcreva este áudio fielmente. Idioma: ${language === "pt" ? "português brasileiro" : language}. Responda apenas com a transcrição, sem aspas nem comentários.` : "Transcreva este áudio fielmente. Responda apenas com a transcrição, sem aspas nem comentários.";
	const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
	let last = "Gemini recusou a transcrição.";
	const b64 = bytes.toString("base64");
	for (const model of models) {
		const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: {
				mime_type: mime || "audio/mpeg",
				data: b64
			} }] }] })
		});
		const json = await res.json().catch(() => null);
		if (res.ok) {
			const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
			if (text) return text;
			last = "O Gemini devolveu uma transcrição vazia.";
			continue;
		}
		last = json?.error?.message ?? `Gemini ${res.status}`;
	}
	throw new Error(last);
}
var transcribeAudio_createServerFn_handler = createServerRpc({
	id: "1aca9326b200150337f980e096c214c18050b73a6c43cfe9f6625561aa6366ab",
	name: "transcribeAudio",
	filename: "src/lib/transcribe.ts"
}, (opts) => transcribeAudio.__executeServer(opts));
var transcribeAudio = createServerFn({ method: "POST" }).validator((input) => input).handler(transcribeAudio_createServerFn_handler, async ({ data }) => {
	const mime = data.mimeType || "application/octet-stream";
	const fileName = mimeToName(mime, data.fileName || "voice.ogg");
	const language = languageParam(data.language);
	const ownKey = data.apiKey?.trim() ?? "";
	let bytes;
	try {
		bytes = Buffer.from(data.audioBase64, "base64");
	} catch {
		return {
			ok: false,
			error: "Áudio inválido."
		};
	}
	if (!bytes.length) return {
		ok: false,
		error: "O áudio está vazio."
	};
	if (bytes.length > MAX_BYTES) return {
		ok: false,
		error: "Áudio grande demais (máx. 3 MB)."
	};
	if (data.provider === "local") return {
		ok: false,
		error: "O Whisper local roda na extensão. Aqui no site, escolha um provedor de nuvem."
	};
	const usingPlatformKey = data.provider === "xai" && !ownKey;
	const apiKey = usingPlatformKey ? process.env.XAI_API_KEY : ownKey;
	if (usingPlatformKey) {
		if (!apiKey) return {
			ok: false,
			error: "Cole uma chave de API em Chaves para transcrever."
		};
		if (!allowDemo(data.sessionId?.trim() || "anon")) return {
			ok: false,
			error: "Limite do modo demonstração. Cole a sua chave da OpenAI, Gemini, Groq ou xAI para continuar."
		};
	} else if (!apiKey) return {
		ok: false,
		error: "Cole a chave de API desse provedor em Chaves."
	};
	try {
		let text = "";
		if (data.provider === "openai") text = await transcribeOpenAI(bytes, mime, fileName, apiKey, language);
		else if (data.provider === "groq") text = await transcribeGroq(bytes, mime, fileName, apiKey, language);
		else if (data.provider === "gemini") text = await transcribeGemini(bytes, mime, apiKey, language);
		else text = await transcribeXai(bytes, mime, fileName, apiKey, language);
		return {
			ok: true,
			text,
			provider: data.provider
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Falha ao transcrever."
		};
	}
});
//#endregion
export { transcribeAudio_createServerFn_handler };
