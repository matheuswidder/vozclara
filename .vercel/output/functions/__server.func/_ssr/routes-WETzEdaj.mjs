import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as CheckCheck, S as Check, _ as EyeOff, a as Smile, b as Download, c as Search, d as Pause, f as MousePointerClick, g as Eye, h as FolderOpen, i as Square, l as Play, m as HardDrive, n as Upload, o as Shield, p as Mic, s as SendHorizontal, t as Video, u as Phone, v as ExternalLink, x as Copy, y as EllipsisVertical } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-WETzEdaj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function formatClock(totalSeconds) {
	if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
	const s = Math.round(totalSeconds);
	return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(/* @__PURE__ */ new Error("Falha ao ler o áudio"));
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(/* @__PURE__ */ new Error("Falha ao ler o áudio"));
				return;
			}
			const comma = result.indexOf(",");
			resolve(comma >= 0 ? result.slice(comma + 1) : result);
		};
		reader.readAsDataURL(blob);
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[opacity,transform,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-accent text-accent-fg hover:opacity-90",
			secondary: "border border-border bg-surface text-fg hover:bg-surface-2",
			ghost: "text-fg-muted hover:bg-surface hover:text-fg",
			link: "text-accent underline-offset-4 hover:underline"
		},
		size: {
			default: "h-11 rounded-md px-4 text-sm",
			sm: "h-9 rounded-sm px-3 text-sm",
			lg: "h-12 rounded-lg px-5 text-base",
			icon: "size-11 rounded-md"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
var STEPS$1 = [
	{
		n: "1",
		title: "Baixe e extraia",
		body: "Baixe o zip e extraia a pasta. O Chrome não aceita o arquivo .zip direto."
	},
	{
		n: "2",
		title: "Carregue a pasta",
		body: "Extensões → modo do desenvolvedor → Carregar sem compactação. Escolha a pasta que mostra o manifest.json."
	},
	{
		n: "3",
		title: "Baixe o Whisper",
		body: "Abra o WhatsApp Web. No ícone da VozClara, clique em Baixar. Deixe a aba aberta até Pronto."
	}
];
function InstallGuide() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-surface p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-medium tracking-tight",
					children: "Instalar no navegador"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-fg-muted",
					children: "Chrome, Brave ou Edge no computador. No celular, use o transcritor desta página com uma chave."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "/vozclara.zip",
						download: "vozclara.zip",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "Baixar extensão"]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 rounded-lg border border-border-strong bg-bg px-4 py-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "mt-0.5 size-4 shrink-0 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium text-fg",
						children: "Pasta errada? O Windows cria uma pasta com o nome do zip."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm leading-relaxed text-fg-muted",
						children: [
							"Entre até ver o arquivo",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-fg",
								children: "manifest.json"
							}),
							". Essa é a pasta certa."
						]
					})] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-4 grid gap-4 sm:grid-cols-2",
				children: STEPS$1.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg bg-bg px-4 py-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs text-accent",
							children: s.n
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-medium text-fg",
							children: s.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed text-fg-muted",
							children: s.body
						})
					]
				}, s.n))
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var transcribeAudio = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("1aca9326b200150337f980e096c214c18050b73a6c43cfe9f6625561aa6366ab"));
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle", "transition-[border-color,box-shadow] duration-150 focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("text-sm font-medium text-fg", className),
		...props
	});
}
var PROVIDERS = [
	{
		id: "local",
		label: "Whisper neste Chrome",
		hint: "Um clique. O modelo fica no navegador",
		keyPlaceholder: "",
		docs: "#local",
		needsKey: false
	},
	{
		id: "openai",
		label: "OpenAI",
		hint: "Whisper / gpt-4o-mini-transcribe",
		keyPlaceholder: "sk-...",
		docs: "https://platform.openai.com/api-keys",
		needsKey: true
	},
	{
		id: "gemini",
		label: "Google Gemini",
		hint: "Gemini 2.5 Flash com áudio",
		keyPlaceholder: "AIza...",
		docs: "https://aistudio.google.com/apikey",
		needsKey: true
	},
	{
		id: "groq",
		label: "Groq",
		hint: "Whisper large-v3 na nuvem",
		keyPlaceholder: "gsk_...",
		docs: "https://console.groq.com/keys",
		needsKey: true
	},
	{
		id: "xai",
		label: "xAI",
		hint: "Speech-to-text da Grok",
		keyPlaceholder: "xai-...",
		docs: "https://console.x.ai",
		needsKey: true
	}
];
var LANGUAGES = [
	{
		id: "pt",
		label: "Português"
	},
	{
		id: "en",
		label: "English"
	},
	{
		id: "es",
		label: "Español"
	},
	{
		id: "auto",
		label: "Detectar"
	}
];
var DEFAULT_LOCAL_URL = "http://127.0.0.1:8173";
var INPAGE_MODELS = [
	{
		id: "turbo",
		label: "v3 turbo",
		size: "~560 MB",
		hint: "Rápido. É o padrão — quase a qualidade do v3."
	},
	{
		id: "v3",
		label: "v3",
		size: "~1,5 GB",
		hint: "Mais preciso. Demora mais para baixar e transcrever."
	},
	{
		id: "light",
		label: "Leve",
		size: "~120 MB",
		hint: "whisper-small. Para computador apertado."
	},
	{
		id: "tiny",
		label: "Whisper tiny",
		size: "~40 MB",
		hint: "OpenAI whisper-tiny. Roda neste Chrome. Leve, qualidade menor."
	},
	{
		id: "nemotron",
		label: "Nemotron 3.5",
		size: "PC",
		hint: "NVIDIA ASR 0.6B no Windows. A extensão baixa o instalador .exe."
	},
	{
		id: "custom",
		label: "Outro Whisper",
		size: "link",
		hint: "Cole um link do Hugging Face. Só Whisper ONNX neste Chrome."
	}
];
var KEY = "vozclara.settings.v1";
function newSessionId() {
	const bytes = /* @__PURE__ */ new Uint8Array(12);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
var DEFAULT_SETTINGS = {
	provider: "xai",
	apiKey: "",
	language: "pt",
	sessionId: "",
	localUrl: DEFAULT_LOCAL_URL
};
function loadSettings() {
	if (typeof window === "undefined") return DEFAULT_SETTINGS;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) {
			const fresh = {
				...DEFAULT_SETTINGS,
				sessionId: newSessionId()
			};
			localStorage.setItem(KEY, JSON.stringify(fresh));
			return fresh;
		}
		const parsed = JSON.parse(raw);
		return {
			provider: parsed.provider ?? "xai",
			apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
			language: parsed.language ?? "pt",
			sessionId: parsed.sessionId || newSessionId(),
			localUrl: typeof parsed.localUrl === "string" && parsed.localUrl.trim() ? parsed.localUrl.trim() : DEFAULT_LOCAL_URL
		};
	} catch {
		return {
			...DEFAULT_SETTINGS,
			sessionId: newSessionId()
		};
	}
}
function saveSettings(next) {
	localStorage.setItem(KEY, JSON.stringify(next));
}
function SettingsPanel() {
	const [settings, setSettings] = (0, import_react.useState)(null);
	const [show, setShow] = (0, import_react.useState)(false);
	const [saved, setSaved] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setSettings(loadSettings());
	}, []);
	if (!settings) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-64 rounded-xl border border-border bg-surface" });
	const current = PROVIDERS.find((p) => p.id === settings.provider);
	const local = settings.provider === "local";
	function patch(partial) {
		setSettings((cur) => {
			if (!cur) return cur;
			const next = {
				...cur,
				...partial
			};
			saveSettings(next);
			setSaved(true);
			window.setTimeout(() => setSaved(false), 1400);
			return next;
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-surface p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl font-medium tracking-tight",
					children: "Chaves"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-xl text-sm text-fg-muted",
					children: "Nuvem: cole a chave. Local: baixe o Whisper no ícone da extensão."
				})] }), saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-1 text-xs text-accent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), " Guardado"]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3",
				children: PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => patch({ provider: p.id }),
					className: cn("rounded-lg border px-4 py-3 text-left transition-colors duration-150", settings.provider === p.id ? "border-accent bg-accent/10" : "border-border bg-bg hover:border-border-strong"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium text-fg",
						children: p.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-fg-muted",
						children: p.hint
					})]
				}, p.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid gap-4 sm:grid-cols-[1fr_11rem]",
				children: [local ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-fg",
							children: "Whisper neste Chrome"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-fg-muted",
							children: "Sem chave. O botão Baixar Whisper fica no ícone da extensão — o modelo não baixa nesta página."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "#local",
							className: "inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent",
							children: "Como funciona o download"
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
							htmlFor: "api-key",
							children: ["Chave de ", current?.label]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "api-key",
								type: show ? "text" : "password",
								autoComplete: "off",
								spellCheck: false,
								placeholder: current?.keyPlaceholder,
								value: settings.apiKey,
								onChange: (e) => patch({ apiKey: e.target.value }),
								className: "pr-11"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center text-fg-muted hover:text-fg",
								onClick: () => setShow((s) => !s),
								"aria-label": show ? "Ocultar chave" : "Mostrar chave",
								children: show ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" })
							})]
						}),
						current?.docs.startsWith("http") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: current.docs,
							target: "_blank",
							rel: "noreferrer",
							className: "inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent",
							children: ["Onde gerar a chave", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "size-3" })]
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "lang",
						children: "Idioma do áudio"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						id: "lang",
						className: "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg",
						value: settings.language,
						onChange: (e) => patch({ language: e.target.value }),
						children: LANGUAGES.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: l.id,
							children: l.label
						}, l.id))
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-xs text-fg-subtle",
				children: "OpenCode não faz speech-to-text. Groq na nuvem também usa large-v3 — o Whisper deste Chrome usa o turbo, sem enviar o áudio."
			})
		]
	});
}
function useLiveSettings() {
	const [settings, setSettings] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		setSettings(loadSettings());
		const on = () => setSettings(loadSettings());
		window.addEventListener("storage", on);
		window.addEventListener("focus", on);
		return () => {
			window.removeEventListener("storage", on);
			window.removeEventListener("focus", on);
		};
	}, []);
	return settings;
}
function LiveTranscribe() {
	const settings = useLiveSettings();
	const [status, setStatus] = (0, import_react.useState)("idle");
	const [name, setName] = (0, import_react.useState)(null);
	const [text, setText] = (0, import_react.useState)("");
	const [seconds, setSeconds] = (0, import_react.useState)(0);
	const recRef = (0, import_react.useRef)(null);
	const chunks = (0, import_react.useRef)([]);
	const tick = (0, import_react.useRef)(0);
	const fileRef = (0, import_react.useRef)(null);
	async function run(blob, fileName) {
		if (!settings) {
			toast.error("Aguarde um instante e tente de novo.");
			return;
		}
		setStatus("busy");
		setName(fileName);
		setText("");
		try {
			if (settings.provider === "local") {
				toast.error("O Whisper local roda na extensão. Aqui no site, escolha um provedor de nuvem.");
				setStatus("idle");
				return;
			}
			const result = await transcribeAudio({ data: {
				audioBase64: await blobToBase64(blob),
				mimeType: blob.type || "audio/webm",
				fileName,
				provider: settings.apiKey ? settings.provider : "xai",
				apiKey: settings.apiKey || void 0,
				language: settings.language,
				sessionId: settings.sessionId
			} });
			if (!result.ok) {
				toast.error(result.error);
				setStatus("idle");
				return;
			}
			setText(result.text);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Falha ao transcrever.");
		} finally {
			setStatus("idle");
		}
	}
	async function onFile(file) {
		if (!file) return;
		if (file.size > 3145728) {
			toast.error("Arquivo acima de 3 MB.");
			return;
		}
		await run(file, file.name);
	}
	async function startRec() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
			const rec = new MediaRecorder(stream, { mimeType: mime });
			chunks.current = [];
			rec.ondataavailable = (e) => {
				if (e.data.size) chunks.current.push(e.data);
			};
			rec.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				window.clearInterval(tick.current);
				run(new Blob(chunks.current, { type: rec.mimeType }), "gravacao.webm");
			};
			rec.start();
			recRef.current = rec;
			setSeconds(0);
			setStatus("recording");
			tick.current = window.setInterval(() => {
				setSeconds((s) => {
					if (s >= 59) {
						rec.stop();
						recRef.current = null;
						return 60;
					}
					return s + 1;
				});
			}, 1e3);
		} catch {
			toast.error("Sem permissão para o microfone.");
		}
	}
	function stopRec() {
		recRef.current?.stop();
		recRef.current = null;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-surface p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl font-medium tracking-tight",
				children: "Transcrever agora"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-fg-muted",
				children: "Envie um ogg, mp3 ou m4a, ou grave pelo microfone. Serve para testar a chave — e no celular, para ler um áudio sem esperar o computador."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-col gap-3 sm:flex-row",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: "audio/*,.ogg,.opus,.mp3,.m4a,.wav,.webm",
						className: "hidden",
						onChange: (e) => void onFile(e.target.files?.[0])
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "secondary",
						className: "flex-1",
						disabled: status !== "idle",
						onClick: () => fileRef.current?.click(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-4" }), "Enviar áudio"]
					}),
					status === "recording" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						className: "flex-1",
						onClick: stopRec,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-4 fill-current" }),
							"Parar ",
							seconds,
							"s"
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						className: "flex-1",
						disabled: status !== "idle",
						onClick: () => void startRec(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" }), "Gravar"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("mt-4 min-h-28 rounded-lg border border-border bg-bg px-4 py-3", status === "busy" && "opacity-80"),
				children: status === "busy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "vozclara-shimmer text-sm font-medium",
					children: "Transcrevendo…"
				}) : text ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] font-medium uppercase tracking-wider text-accent",
						children: name ?? "Transcrição"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "text-fg-muted hover:text-fg",
						onClick: async () => {
							await navigator.clipboard.writeText(text);
							toast.success("Copiado");
						},
						"aria-label": "Copiar",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					"data-live-transcript": "1",
					className: "text-sm leading-relaxed text-fg",
					children: text
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-fg-subtle",
					children: "A transcrição aparece aqui. Sem chave, o modo demonstração usa xAI com um limite curto."
				})
			})
		]
	});
}
var STEPS = [
	{
		n: "1",
		title: "Instale",
		body: "Extraia o zip e carregue a pasta do manifest.json."
	},
	{
		n: "2",
		title: "Baixe o modelo",
		body: "No ícone da VozClara, escolha turbo ou v3 e clique em Baixar."
	},
	{
		n: "3",
		title: "Transcreva",
		body: "No WhatsApp Web, o cartão Transcrever aparece em cada áudio."
	}
];
function LocalEngine() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-surface p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-[0.18em] text-accent",
							children: "Offline"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-2xl font-medium tracking-tight",
							children: "Whisper neste Chrome"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-fg-muted",
							children: "O modelo baixa uma vez e fica no navegador. Abrir no Explorer copia para Downloads/VozClara. Nemotron (Windows): a extensão baixa o instalador VozClara-Motor-Setup.exe. Abra e clique Instalar."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					className: "shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "/vozclara.zip",
						download: "vozclara.zip",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "Baixar extensão"]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 grid gap-3 sm:grid-cols-2",
				children: INPAGE_MODELS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-lg border border-border bg-bg px-4 py-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium text-fg",
							children: m.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs text-accent",
							children: m.size
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm leading-relaxed text-fg-muted",
						children: m.hint
					})]
				}, m.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "mt-5 grid gap-3 sm:grid-cols-3",
				children: STEPS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-lg bg-bg px-4 py-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs text-accent",
							children: s.n
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-medium text-fg",
							children: s.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed text-fg-muted",
							children: s.body
						})
					]
				}, s.n))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex gap-3 rounded-lg border border-border bg-bg px-4 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "mt-0.5 size-4 shrink-0 text-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-fg",
					children: "O download acontece na extensão, não nesta página"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-fg-muted",
					children: "No celular a extensão não instala. Use uma chave de nuvem no transcritor ao lado."
				})] })]
			})
		]
	});
}
function Mark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 32 32",
		className: cn("size-8", className),
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "32",
				height: "32",
				rx: "9",
				fill: "currentColor",
				className: "text-surface-2"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "7",
				y: "13",
				width: "2.4",
				height: "6",
				rx: "1.2",
				className: "fill-accent"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "11.2",
				y: "9",
				width: "2.4",
				height: "14",
				rx: "1.2",
				className: "fill-accent"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "15.4",
				y: "7",
				width: "2.4",
				height: "18",
				rx: "1.2",
				className: "fill-accent"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "19.6",
				y: "11",
				width: "2.4",
				height: "10",
				rx: "1.2",
				className: "fill-accent"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: "23.8",
				y: "14",
				width: "2.4",
				height: "4",
				rx: "1.2",
				className: "fill-accent"
			})
		]
	});
}
function Wordmark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-2.5", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-display text-lg font-medium tracking-tight text-fg",
			children: "VozClara"
		})]
	});
}
var LINKS = [
	{
		href: "#demo",
		label: "Demo"
	},
	{
		href: "#instalar",
		label: "Instalar"
	},
	{
		href: "#local",
		label: "Whisper"
	},
	{
		href: "#chaves",
		label: "Nuvem"
	}
];
function SiteHeader() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-md",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#topo",
				className: "shrink-0",
				"aria-label": "VozClara",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex items-center gap-1 text-sm",
				children: LINKS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: l.href,
					className: "inline-flex min-h-11 items-center rounded-sm px-2 text-fg-muted transition-colors duration-150 hover:text-fg sm:px-3",
					children: l.label
				}, l.href))
			})]
		})
	});
}
var DEMO_CHATS = [{
	id: "marina",
	name: "Marina",
	initials: "MA",
	preview: "0:09",
	time: "18:42",
	unread: 2,
	status: "online",
	messages: [
		{
			id: "m1",
			kind: "text",
			from: "in",
			time: "18:40",
			text: "Você vai passar no mercado?"
		},
		{
			id: "m2",
			kind: "voice",
			from: "in",
			time: "18:41",
			src: "/demo/mercado.mp3",
			duration: 9,
			seed: 41,
			transcript: "Oi, passa no mercado se puder. Precisa de leite, pão, ovos e aquele queijo prato que a gente gosta. Se não tiver, o mussarela serve."
		},
		{
			id: "m3",
			kind: "text",
			from: "out",
			time: "18:41",
			text: "Tô saindo agora"
		},
		{
			id: "m4",
			kind: "voice",
			from: "in",
			time: "18:42",
			src: "/demo/cafe.mp3",
			duration: 10,
			seed: 77,
			transcript: "Espera, e também café. O pacote acabou ontem. Ah, e se o pão francês estiver fresco, pega uns seis. Valeu, te vejo daqui a pouco."
		}
	]
}, {
	id: "escritorio",
	name: "Escritório",
	initials: "ES",
	preview: "0:09",
	time: "17:18",
	unread: 1,
	status: "visto por último hoje às 17:20",
	messages: [
		{
			id: "e1",
			kind: "text",
			from: "in",
			time: "17:12",
			text: "Consegue olhar o áudio? Estou no trânsito."
		},
		{
			id: "e2",
			kind: "voice",
			from: "in",
			time: "17:18",
			src: "/demo/reuniao.mp3",
			duration: 9,
			seed: 19,
			transcript: "A reunião com o cliente ficou para terça às duas. Leva o deck atualizado, o da semana passada já não vale. Qualquer coisa me chama."
		},
		{
			id: "e3",
			kind: "text",
			from: "out",
			time: "17:19",
			text: "Ouvi. Já anoto."
		}
	]
}];
function seededBars(seed, count) {
	const bars = [];
	let s = seed || 1;
	for (let i = 0; i < count; i++) {
		s = s * 1664525 + 1013904223 >>> 0;
		bars.push(.22 + s % 78 / 100);
	}
	return bars;
}
function Waveform({ seed, progress, playing }) {
	const bars = (0, import_react.useMemo)(() => seededBars(seed, 28), [seed]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-7 flex-1 items-center gap-px",
		"aria-hidden": "true",
		children: bars.map((h, i) => {
			const filled = i / bars.length <= progress;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: cn("vozclara-bar w-[3px] rounded-full origin-center", filled ? "bg-wa-green" : "bg-wa-meta/70"),
				style: {
					height: `${h * 100}%`,
					animation: playing ? `vozclara-bars 900ms ease-in-out ${i * 40}ms infinite` : void 0
				}
			}, i);
		})
	});
}
function VoiceBubble({ msg, active, onToggle, onContext, onTranscribe, transcript, status }) {
	const audioRef = (0, import_react.useRef)(null);
	const isThis = active?.id === msg.id;
	const playing = Boolean(isThis && active?.playing);
	const progress = isThis ? active?.progress ?? 0 : 0;
	const outgoing = msg.from === "out";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex", outgoing ? "justify-end" : "justify-start"),
		"data-voice-id": msg.id,
		onContextMenu: (e) => onContext(e, msg.id),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-[min(100%,22rem)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: cn("rounded-lg px-2 py-1.5 shadow-sm", outgoing ? "rounded-tr-sm bg-wa-out" : "rounded-tl-sm bg-wa-in"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "flex size-9 shrink-0 items-center justify-center rounded-full bg-wa-green text-wa-bg",
								onClick: () => {
									const el = audioRef.current;
									if (el) onToggle(msg.id, el);
								},
								"aria-label": playing ? "Pausar áudio" : "Reproduzir áudio",
								children: playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 translate-x-px fill-current" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Waveform, {
								seed: msg.seed,
								progress,
								playing
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-wa-meta",
								children: formatClock(playing || progress > 0 ? msg.duration * (1 - progress) : msg.duration)
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
						ref: audioRef,
						src: msg.src,
						preload: "metadata",
						className: "hidden"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 flex items-center justify-end gap-1 text-[11px] text-wa-meta",
						children: [msg.time, outgoing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckCheck, { className: "size-3.5 text-wa-tick" }) : null]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1.5 mb-2 rounded-md border-l-2 border-wa-green bg-wa-panel px-3 py-2",
				children: status === "working" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "vozclara-shimmer text-xs font-medium",
					children: "Transcrevendo…"
				}) : transcript ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-1 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] font-medium uppercase tracking-wider text-wa-green",
						children: "VozClara"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, { text: transcript })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13.5px] leading-snug text-wa-text",
					children: transcript
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-1.5 text-[10px] font-medium uppercase tracking-wider text-wa-green",
					children: "VozClara"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onTranscribe(msg.id),
					className: "min-h-8 w-full rounded-md bg-wa-green px-3 text-[12.5px] font-semibold text-wa-bg hover:opacity-90",
					children: "Transcrever"
				})] })
			})]
		})
	});
}
function CopyButton({ text }) {
	const [done, setDone] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "text-wa-meta hover:text-wa-text",
		onClick: async () => {
			try {
				await navigator.clipboard.writeText(text);
				setDone(true);
				window.setTimeout(() => setDone(false), 1200);
			} catch {}
		},
		"aria-label": "Copiar transcrição",
		children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-[10px] text-wa-green",
			children: "Copiado"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" })
	});
}
function TextBubble({ msg }) {
	const outgoing = msg.from === "out";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex", outgoing ? "justify-end" : "justify-start"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("max-w-[min(100%,22rem)] rounded-lg px-2.5 py-1.5 text-[14.5px] leading-snug text-wa-text shadow-sm", outgoing ? "rounded-tr-sm bg-wa-out" : "rounded-tl-sm bg-wa-in"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: msg.text }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 flex items-center justify-end gap-1 text-[11px] text-wa-meta",
				children: [msg.time, outgoing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckCheck, { className: "size-3.5 text-wa-tick" }) : null]
			})]
		})
	});
}
function WhatsAppSimulator() {
	const [chatId, setChatId] = (0, import_react.useState)(DEMO_CHATS[0].id);
	const chat = DEMO_CHATS.find((c) => c.id === chatId) ?? DEMO_CHATS[0];
	const [active, setActive] = (0, import_react.useState)(null);
	const [transcripts, setTranscripts] = (0, import_react.useState)({});
	const [status, setStatus] = (0, import_react.useState)({});
	const [menu, setMenu] = (0, import_react.useState)(null);
	const [hint, setHint] = (0, import_react.useState)(true);
	const [coarse, setCoarse] = (0, import_react.useState)(false);
	const timers = (0, import_react.useRef)({});
	(0, import_react.useEffect)(() => {
		const mq = window.matchMedia("(pointer: coarse)");
		setCoarse(mq.matches);
		const on = () => setCoarse(mq.matches);
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!menu) return;
		const close = (ev) => {
			const t = ev.target;
			if (t instanceof Element && t.closest("[data-ctx-menu]")) return;
			setMenu(null);
		};
		const id = window.setTimeout(() => {
			window.addEventListener("click", close);
			window.addEventListener("pointerdown", close);
		}, 0);
		return () => {
			window.clearTimeout(id);
			window.removeEventListener("click", close);
			window.removeEventListener("pointerdown", close);
		};
	}, [menu]);
	function toggle(id, el) {
		if (active?.id && active.id !== id) document.querySelectorAll("audio").forEach((a) => {
			if (a !== el) a.pause();
		});
		if (active?.id === id && active.playing) {
			el.pause();
			setActive({
				id,
				playing: false,
				progress: el.currentTime / (el.duration || 1)
			});
			return;
		}
		el.play();
		setActive({
			id,
			playing: true,
			progress: el.currentTime / (el.duration || 1)
		});
		const onTime = () => {
			setActive((cur) => cur?.id === id ? {
				id,
				playing: !el.paused,
				progress: el.currentTime / (el.duration || 1)
			} : cur);
		};
		const onEnd = () => setActive({
			id,
			playing: false,
			progress: 1
		});
		el.ontimeupdate = onTime;
		el.onended = onEnd;
	}
	function transcribe(id) {
		const msg = chat.messages.find((m) => m.id === id);
		if (!msg || msg.kind !== "voice") return;
		if (transcripts[id] || status[id] === "working") return;
		setHint(false);
		setMenu(null);
		setStatus((s) => ({
			...s,
			[id]: "working"
		}));
		window.clearTimeout(timers.current[id]);
		timers.current[id] = window.setTimeout(() => {
			setTranscripts((t) => ({
				...t,
				[id]: msg.transcript
			}));
			setStatus((s) => ({
				...s,
				[id]: "done"
			}));
		}, 900 + msg.duration % 4 * 180);
	}
	function onContext(e, id) {
		e.preventDefault();
		e.stopPropagation();
		const pad = 8;
		const w = 240;
		const h = 88;
		const x = Math.min(e.clientX, window.innerWidth - w - pad);
		const y = Math.min(e.clientY, window.innerHeight - h - pad);
		setMenu({
			x,
			y,
			id
		});
		setHint(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-xl border border-border bg-wa-panel shadow-[0_24px_80px_-32px_rgba(0,0,0,0.65)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid min-h-[34rem] md:grid-cols-[16.5rem_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden flex-col border-r border-black/40 bg-wa-panel md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 border-b border-black/30 bg-wa-header px-3 py-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-9 rounded-full bg-wa-input" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "flex-1 text-sm text-wa-text",
								children: "Conversas"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EllipsisVertical, { className: "size-4 text-wa-meta" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 py-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex h-8 items-center gap-2 rounded-lg bg-wa-bg px-3 text-wa-meta",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs",
								children: "Pesquisar"
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex-1 overflow-auto",
						children: DEMO_CHATS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setChatId(c.id),
							className: cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", c.id === chatId ? "bg-wa-header" : "hover:bg-wa-header/60"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-green/20 text-xs font-medium text-wa-green",
								children: c.initials
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-baseline justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate text-sm text-wa-text",
										children: c.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] text-wa-meta",
										children: c.time
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate text-xs text-wa-meta",
										children: "Mensagem de voz"
									}), c.unread > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex size-4 items-center justify-center rounded-full bg-wa-green text-[10px] font-medium text-wa-bg",
										children: c.unread
									}) : null]
								})]
							})]
						}) }, c.id))
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex min-h-[34rem] flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex items-center gap-3 bg-wa-header px-3 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex size-9 items-center justify-center rounded-full bg-wa-green/20 text-xs font-medium text-wa-green",
								children: chat.initials
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									className: "w-full bg-transparent text-sm font-medium text-wa-text md:pointer-events-none md:appearance-none",
									value: chatId,
									onChange: (e) => setChatId(e.target.value),
									"aria-label": "Conversas",
									children: DEMO_CHATS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: c.id,
										children: c.name
									}, c.id))
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-[11px] text-wa-meta",
									children: chat.status
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hidden items-center gap-4 text-wa-meta sm:flex",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Video, { className: "size-4" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-4" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" })
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "wa-doodle relative flex-1 space-y-2 overflow-auto px-3 py-3 sm:px-6",
						children: [
							hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pointer-events-none absolute left-1/2 top-3 z-10 w-[min(90%,18rem)] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-center text-[11px] text-wa-text",
								children: coarse ? "Toque em Transcrever no áudio" : "Clique com o botão direito em um áudio"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "py-2 text-center text-[11px] text-wa-meta",
								children: "Hoje"
							}),
							chat.messages.map((msg) => msg.kind === "text" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextBubble, { msg }, msg.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoiceBubble, {
								msg,
								active,
								onToggle: toggle,
								onContext,
								onTranscribe: transcribe,
								transcript: transcripts[msg.id],
								status: status[msg.id]
							}, msg.id))
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
						className: "flex items-center gap-2 bg-wa-header px-2 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smile, { className: "size-5 text-wa-meta" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex h-9 flex-1 items-center rounded-lg bg-wa-input px-3 text-sm text-wa-meta",
								children: "Mensagem"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-5 text-wa-meta" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SendHorizontal, { className: "size-5 text-wa-meta" })
						]
					})
				]
			})]
		}), menu ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			"data-ctx-menu": "1",
			className: "fixed z-50 min-w-56 overflow-hidden rounded-sm border border-border-strong bg-ctx py-1 shadow-xl",
			style: {
				left: menu.x,
				top: menu.y
			},
			onClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-fg hover:bg-ctx-hover",
				onClick: () => transcribe(menu.id),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex size-6 items-center justify-center rounded-xs bg-accent/15 text-accent",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-3.5" })
				}), "Transcrever com VozClara"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "flex w-full items-center px-3 py-2 text-left text-sm text-fg-muted hover:bg-ctx-hover hover:text-fg",
				onClick: () => setMenu(null),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "pl-9",
					children: "Cancelar"
				})
			})]
		}) : null]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		id: "topo",
		className: "min-h-dvh bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mx-auto grid max-w-6xl gap-10 px-4 pb-8 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:pt-16",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-[0.18em] text-accent",
							children: "Chrome, Brave e Edge"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
							className: "mt-4 font-display text-3xl font-medium leading-[1.12] tracking-tight sm:text-5xl",
							children: ["Áudio do WhatsApp", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block italic text-fg-muted",
								children: "vira texto no chat."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-5 max-w-md text-base leading-relaxed text-fg-muted",
							children: "Instale a extensão, baixe o Whisper uma vez e clique em Transcrever. O áudio não sai do computador."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7 flex flex-wrap gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: "/vozclara.zip",
									download: "vozclara.zip",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "size-4" }), "Baixar extensão"]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								variant: "secondary",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#instalar",
									children: "Como instalar"
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "mt-8 grid gap-4 text-sm text-fg-muted sm:grid-cols-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MousePointerClick, { className: "mt-0.5 size-4 shrink-0 text-accent" }), "Um clique no áudio"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "mt-0.5 size-4 shrink-0 text-accent" }), "Whisper neste Chrome"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "mt-0.5 size-4 shrink-0 text-accent" }), "Ou chave da nuvem"]
								})
							]
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						id: "demo",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WhatsAppSimulator, {})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						id: "instalar",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InstallGuide, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveTranscribe, {})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "local",
					className: "mx-auto max-w-6xl px-4 pb-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocalEngine, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "chaves",
					className: "mx-auto max-w-6xl px-4 pb-16",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsPanel, {})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-border py-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "VozClara. Sem vínculo com WhatsApp ou Meta." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No computador. Não instala no celular." })]
				})
			})
		]
	});
}
//#endregion
export { Home as component };
