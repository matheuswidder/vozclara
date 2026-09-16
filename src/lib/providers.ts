export const PROVIDERS = [
  {
    id: "local",
    label: "Whisper neste Chrome",
    hint: "Um clique. O modelo fica no navegador",
    keyPlaceholder: "",
    docs: "#local",
    needsKey: false,
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Whisper / gpt-4o-mini-transcribe",
    keyPlaceholder: "sk-...",
    docs: "https://platform.openai.com/api-keys",
    needsKey: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "Gemini 2.5 Flash com áudio",
    keyPlaceholder: "AIza...",
    docs: "https://aistudio.google.com/apikey",
    needsKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    hint: "Whisper large-v3 na nuvem",
    keyPlaceholder: "gsk_...",
    docs: "https://console.groq.com/keys",
    needsKey: true,
  },
  {
    id: "xai",
    label: "xAI",
    hint: "Speech-to-text da Grok",
    keyPlaceholder: "xai-...",
    docs: "https://console.x.ai",
    needsKey: true,
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const LANGUAGES = [
  { id: "pt", label: "Português" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "auto", label: "Detectar" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const DEFAULT_LOCAL_URL = "http://127.0.0.1:8173";

export const INPAGE_MODELS = [
  {
    id: "turbo",
    label: "Turbo",
    size: "~560 MB",
    hint: "Padrão. Rápido e preciso o bastante para conversas.",
  },
  {
    id: "light",
    label: "Small",
    size: "~120 MB",
    hint: "Mais leve. Só entra se você trocar no seletor.",
  },
] as const;
