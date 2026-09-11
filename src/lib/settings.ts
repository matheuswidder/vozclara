import { DEFAULT_LOCAL_URL, type LanguageId, type ProviderId } from "./providers";

const KEY = "vozclara.settings.v1";

export type VozClaraSettings = {
  provider: ProviderId;
  apiKey: string;
  language: LanguageId;
  sessionId: string;
  localUrl: string;
};

function newSessionId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const DEFAULT_SETTINGS: VozClaraSettings = {
  provider: "xai",
  apiKey: "",
  language: "pt",
  sessionId: "",
  localUrl: DEFAULT_LOCAL_URL,
};

export function loadSettings(): VozClaraSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const fresh = { ...DEFAULT_SETTINGS, sessionId: newSessionId() };
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<VozClaraSettings>;
    return {
      provider: parsed.provider ?? "xai",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      language: parsed.language ?? "pt",
      sessionId: parsed.sessionId || newSessionId(),
      localUrl:
        typeof parsed.localUrl === "string" && parsed.localUrl.trim()
          ? parsed.localUrl.trim()
          : DEFAULT_LOCAL_URL,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, sessionId: newSessionId() };
  }
}

export function saveSettings(next: VozClaraSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
