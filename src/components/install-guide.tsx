import { Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "1",
    title: "Baixe e extraia",
    body: "Baixe o zip e extraia a pasta. O Chrome não aceita o arquivo .zip direto.",
  },
  {
    n: "2",
    title: "Carregue a pasta",
    body: "Extensões → modo do desenvolvedor → Carregar sem compactação. Escolha a pasta que mostra o manifest.json.",
  },
  {
    n: "3",
    title: "Baixe o Whisper",
    body: "Abra o WhatsApp Web. No ícone da VozClara, clique em Baixar. Deixe a aba aberta até Pronto.",
  },
];

export function InstallGuide() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Instalar no navegador
          </h2>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">
            Chrome, Brave ou Edge no computador. No celular, use o transcritor
            desta página com uma chave.
          </p>
        </div>
        <Button asChild>
          <a href="/vozclara.zip" download="vozclara.zip">
            <Download className="size-4" />
            Baixar extensão
          </a>
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-border-strong bg-bg px-4 py-4">
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

      <ol className="mt-4 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-lg bg-bg px-4 py-4">
            <p className="font-mono text-xs text-accent">{s.n}</p>
            <p className="mt-1 font-medium text-fg">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
