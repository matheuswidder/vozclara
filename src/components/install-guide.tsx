import { Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "1",
    title: "Baixe o zip",
    body: "Só este arquivo. Dentro vai a extensão pronta para o Chrome, Brave ou Edge.",
  },
  {
    n: "2",
    title: "Carregue a pasta",
    body: "Extensões → modo do desenvolvedor → Carregar sem compactação. Escolha a pasta do manifest.json.",
  },
  {
    n: "3",
    title: "Baixe o modelo",
    body: "No ícone da VozClara, deixe Large Turbo e clique em Baixar. Uma vez, neste Chrome.",
  },
];

export function InstallGuide() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 motion-safe:animate-[vozclara-rise_0.5s_ease_both]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Instalar no navegador
          </h2>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">
            Chrome, Brave ou Edge no computador. Um zip, o Whisper no Chrome,
            pronto.
          </p>
        </div>
        <Button asChild>
          <a href="/vozclara.zip" download="vozclara.zip">
            <Download className="size-4" />
            Baixar o zip
          </a>
        </Button>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="group relative overflow-hidden rounded-lg bg-bg px-4 py-4 transition-colors duration-150 hover:bg-surface-2"
          >
            <p className="flex size-7 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-medium text-accent">
              {s.n}
            </p>
            <p className="mt-3 font-medium text-fg">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-lg border border-border-strong bg-bg px-4 py-4">
        <div className="flex gap-3">
          <FolderOpen className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-fg">
              Pasta errada? O Windows cria uma pasta com o nome do zip.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              Entre até ver o arquivo{" "}
              <span className="font-mono text-fg">manifest.json</span>. Essa é
              a pasta certa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
