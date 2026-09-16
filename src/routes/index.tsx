import { createFileRoute } from "@tanstack/react-router";
import { Download, HardDrive, MousePointerClick, Shield } from "lucide-react";
import { InstallGuide } from "@/components/install-guide";
import { LiveTranscribe } from "@/components/live-transcribe";
import { LocalEngine } from "@/components/local-engine";
import { SettingsPanel } from "@/components/settings-panel";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppSimulator } from "@/components/whatsapp-simulator";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div id="topo" className="relative min-h-dvh overflow-x-clip bg-bg text-fg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(900px_280px_at_20%_-10%,color-mix(in_oklab,var(--color-accent)_18%,transparent),transparent_70%)]"
      />
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-8 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:pt-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Chrome, Brave e Edge
            </p>
            <h1 className="mt-4 font-display text-3xl font-medium leading-[1.12] tracking-tight sm:text-5xl">
              Áudio do WhatsApp
              <span className="block italic text-fg-muted">vira texto no chat.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-fg-muted">
              Um zip com a extensão. Baixe o Turbo uma vez, transcreva.
              O áudio não sai do computador.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild>
                <a href="/vozclara.zip" download="vozclara.zip">
                  <Download className="size-4" />
                  Baixar o zip
                </a>
              </Button>
              <Button asChild variant="secondary">
                <a href="#instalar">Como instalar</a>
              </Button>
            </div>
            <ul className="mt-8 grid gap-4 text-sm text-fg-muted sm:grid-cols-3">
              <li className="flex gap-2">
                <MousePointerClick className="mt-0.5 size-4 shrink-0 text-accent" />
                Um clique no áudio
              </li>
              <li className="flex gap-2">
                <Shield className="mt-0.5 size-4 shrink-0 text-accent" />
                Whisper neste Chrome
              </li>
              <li className="flex gap-2">
                <HardDrive className="mt-0.5 size-4 shrink-0 text-accent" />
                Turbo ou Small, no Chrome
              </li>
            </ul>
          </div>

          <div id="demo">
            <WhatsAppSimulator />
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-2">
          <div id="instalar">
            <InstallGuide />
          </div>
          <LiveTranscribe />
        </section>

        <section id="local" className="mx-auto max-w-6xl px-4 pb-6">
          <LocalEngine />
        </section>

        <section id="chaves" className="mx-auto max-w-6xl px-4 pb-16">
          <SettingsPanel />
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>VozClara. Sem vínculo com WhatsApp ou Meta.</p>
          <p>No computador. Não instala no celular.</p>
        </div>
      </footer>
    </div>
  );
}
