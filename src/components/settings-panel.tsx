import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LANGUAGES, PROVIDERS, type LanguageId, type ProviderId } from "@/lib/providers";
import { loadSettings, saveSettings, type VozClaraSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const [settings, setSettings] = useState<VozClaraSettings | null>(null);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  if (!settings) {
    return <div className="h-64 rounded-xl border border-border bg-surface" />;
  }

  const current = PROVIDERS.find((p) => p.id === settings.provider);
  const local = settings.provider === "local";

  function patch(partial: Partial<VozClaraSettings>) {
    setSettings((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...partial };
      saveSettings(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Chaves</h2>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">
            Nuvem: cole a chave. Local: baixe o Whisper no ícone da extensão.
          </p>
        </div>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-accent motion-safe:animate-[vozclara-rise_0.25s_ease]">
            <Check className="size-3.5" /> Guardado
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => patch({ provider: p.id })}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors duration-150",
              settings.provider === p.id
                ? "border-accent bg-accent/10"
                : "border-border bg-bg hover:border-border-strong",
            )}
          >
            <p className="text-sm font-medium text-fg">{p.label}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{p.hint}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_11rem]">
        {local ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-fg">Whisper neste Chrome</p>
            <p className="text-sm leading-relaxed text-fg-muted">
              Sem chave e sem Setup. O Whisper baixa no ícone da extensão
              e roda neste Chrome.
            </p>
            <a
              href="#local"
              className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent"
            >
              Como funciona o download
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="api-key">Chave de {current?.label}</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={show ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder={current?.keyPlaceholder}
                value={settings.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                className="pr-11"
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center text-fg-muted hover:text-fg"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar chave" : "Mostrar chave"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {current?.docs.startsWith("http") ? (
              <a
                href={current.docs}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent"
              >
                Onde gerar a chave
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="lang">Idioma do áudio</Label>
          <select
            id="lang"
            className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg"
            value={settings.language}
            onChange={(e) => patch({ language: e.target.value as LanguageId })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 text-xs text-fg-subtle">
        OpenCode não faz speech-to-text. Groq na nuvem também usa large-v3 — o
        Whisper deste Chrome usa o turbo, sem enviar o áudio.
      </p>
    </div>
  );
}

export function useLiveSettings() {
  const [settings, setSettings] = useState<VozClaraSettings | null>(null);
  useEffect(() => {
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

export function currentProvider(settings: VozClaraSettings | null): ProviderId {
  return settings?.provider ?? "xai";
}
