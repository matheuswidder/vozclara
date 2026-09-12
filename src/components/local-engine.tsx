import { Download, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INPAGE_MODELS } from "@/lib/providers";

const STEPS = [
  {
    n: "1",
    title: "Instale",
    body: "Extraia o zip e carregue a pasta do manifest.json.",
  },
  {
    n: "2",
    title: "Baixe o modelo",
    body: "No ícone da VozClara, escolha o modelo e clique em Baixar e usar.",
  },
  {
    n: "3",
    title: "Transcreva",
    body: "No WhatsApp Web, o cartão Transcrever aparece em cada áudio.",
  },
];

export function LocalEngine() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Offline
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">
            Whisper neste Chrome
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Um clique em Baixar e usar. Turbo é o recomendado. Tiny é o mais
            leve. Nemotron é um programa à parte, no Windows.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <a href="/vozclara.zip" download="vozclara.zip">
            <Download className="size-4" />
            Baixar extensão
          </a>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {INPAGE_MODELS.map((m) => (
          <article
            key={m.id}
            className="rounded-lg border border-border bg-bg px-4 py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-fg">{m.label}</p>
              <p className="font-mono text-xs text-accent">{m.size}</p>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{m.hint}</p>
          </article>
        ))}
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg bg-bg px-4 py-4">
            <p className="font-mono text-xs text-accent">{s.n}</p>
            <p className="mt-1 font-medium text-fg">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex gap-3 rounded-lg border border-border bg-bg px-4 py-4">
        <HardDrive className="mt-0.5 size-4 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-medium text-fg">
            O download acontece na extensão, não nesta página
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            No celular a extensão não instala. Use uma chave de nuvem no
            transcritor ao lado.
          </p>
        </div>
      </div>
    </div>
  );
}
