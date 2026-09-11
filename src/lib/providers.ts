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
    label: "v3 turbo",
    size: "~560 MB",
    hint: "Rápido. É o padrão — quase a qualidade do v3.",
  },
  {
    id: "v3",
    label: "v3",
    size: "~1,5 GB",
    hint: "Mais preciso. Demora mais para baixar e transcrever.",
  },
  {
    id: "light",
    label: "Leve",
    size: "~120 MB",
    hint: "whisper-small. Para computador apertado.",
  },
  {
    id: "tiny",
    label: "Whisper tiny",
    size: "~40 MB",
    hint: "OpenAI whisper-tiny. Roda neste Chrome. Leve, qualidade menor.",
  },
  {
    id: "nemotron",
    label: "Nemotron 3.5",
    size: "PC",
    hint: "NVIDIA ASR 0.6B no Windows. A extensão baixa o instalador .exe.",
  },
  {
    id: "custom",
    label: "Outro Whisper",
    size: "link",
    hint: "Cole um link do Hugging Face. Só Whisper ONNX neste Chrome.",
  },
] as const;
