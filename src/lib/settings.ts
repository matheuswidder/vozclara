import type { LanguageId, ProviderId } from "./providers";

const KEY = "vozclara.settings.v1";

export type VozClaraSettings = {
  provider: ProviderId;
  apiKey: string;
  language: LanguageId;
  sessionId: string;
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
    };
  } catch {
    return { ...DEFAULT_SETTINGS, sessionId: newSessionId() };
  }
}

export function saveSettings(next: VozClaraSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
