import { Download, Github } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";

const REPO_URL = "https://github.com/matheuswidder/vozclara";

const LINKS = [
  { href: "#demo", label: "Demo" },
  { href: "#instalar", label: "Instalar" },
  { href: "#local", label: "Whisper" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
        <a href="#topo" className="shrink-0" aria-label="VozClara">
          <Wordmark />
        </a>

        <p className="hidden justify-self-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium tracking-wide text-fg-muted lg:inline-flex">
          100% open source
        </p>

        <nav className="flex items-center justify-end gap-1 text-sm">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden min-h-11 items-center rounded-sm px-2 text-fg-muted transition-colors duration-150 hover:text-fg sm:inline-flex sm:px-3"
            >
              {l.label}
            </a>
          ))}
          <Button asChild variant="secondary" size="sm">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <Github className="size-3.5" />
              <span className="hidden lg:inline">GitHub</span>
              <span className="sr-only lg:hidden">Repositório no GitHub</span>
            </a>
          </Button>
          <Button asChild size="sm">
            <a href="/vozclara.zip" download="vozclara.zip">
              <Download className="size-3.5" />
              Zip
            </a>
          </Button>
        </nav>
      </div>
    </header>
  );
}
