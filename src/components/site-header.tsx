import { Download } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "#demo", label: "Demo" },
  { href: "#instalar", label: "Instalar" },
  { href: "#local", label: "Whisper" },
  { href: "#chaves", label: "Nuvem" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#topo" className="shrink-0" aria-label="VozClara">
          <Wordmark />
        </a>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden min-h-11 items-center rounded-sm px-2 text-fg-muted transition-colors duration-150 hover:text-fg sm:inline-flex sm:px-3"
            >
              {l.label}
            </a>
          ))}
          <Button asChild size="sm" className="ml-1">
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
