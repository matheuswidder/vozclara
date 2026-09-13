import { HardDrive } from "lucide-react";
import { INPAGE_MODELS } from "@/lib/providers";

const STEPS = [
  {
    n: "1",
    title: "Whisper no Chrome",
    body: "No ícone da VozClara, escolha Turbo (ou Tiny) e Baixar. Isso baixa só o modelo, uma vez.",
  },
  {
    n: "2",
    title: "Motor Windows",
    body: "Nemotron e Gemma usam o Setup que já está no zip. Não peça outro download — o Chrome recusa o .exe duplicado.",
  },
  {
    n: "3",
    title: "Verificar",
    body: "Depois do Setup, o botão vira Verificar. Se a bandeja estiver verde, está ok.",
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
          Um clique em Baixar para o Whisper. O motor Windows já veio no mesmo
          zip — instale uma vez e depois só verifique.
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
            O Whisper baixa na extensão. O motor, não.
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Setup em <span className="font-mono text-fg">engine/</span> no zip.
            No celular a extensão não instala — use uma chave de nuvem ao lado.
          </p>
        </div>
      </div>
    </div>
  );
}
