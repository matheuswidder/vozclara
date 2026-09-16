import { HardDrive } from "lucide-react";
import { INPAGE_MODELS } from "@/lib/providers";

const STEPS = [
  {
    n: "1",
    title: "Turbo",
    body: "Já vem selecionado. Clique em Baixar uma vez. ~560 MB neste Chrome.",
  },
  {
    n: "2",
    title: "Small",
    body: "Só se você trocar no seletor. Mais leve (~120 MB), um pouco menos preciso.",
  },
  {
    n: "3",
    title: "Ao receber",
    body: "Opcional. Liga Transcrever ao receber: áudios novos da conversa aberta já saem em texto.",
  },
];

export function LocalEngine() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 motion-safe:animate-[vozclara-rise_0.55s_ease_both]">
      <div className="max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Offline
        </p>
        <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">
          Whisper neste Chrome
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Um clique em Baixar. Turbo é o padrão. O áudio não sai deste
          computador.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {INPAGE_MODELS.map((m) => (
          <article
            key={m.id}
            className="rounded-lg border border-border bg-bg px-4 py-4 transition-colors duration-150 hover:border-border-strong"
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
            <p className="flex size-7 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-medium text-accent">
              {s.n}
            </p>
            <p className="mt-3 font-medium text-fg">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex gap-3 rounded-lg border border-border bg-bg px-4 py-4">
        <HardDrive className="mt-0.5 size-4 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-medium text-fg">
            O Whisper baixa na extensão. Sem programa separado.
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Nada sai deste Chrome. No celular a extensão não instala — use uma chave de nuvem ao lado.
          </p>
        </div>
      </div>
    </div>
  );
}
