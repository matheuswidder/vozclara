import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  CheckCheck,
  Copy,
  Mic,
  MoreVertical,
  Pause,
  Phone,
  Play,
  Search,
  SendHorizonal,
  Smile,
  Video,
} from "lucide-react";
import { DEMO_CHATS, type ChatMessage } from "@/lib/demo-chat";
import { cn, formatClock } from "@/lib/utils";

type MenuState = { x: number; y: number; id: string } | null;

function seededBars(seed: number, count: number) {
  const bars: number[] = [];
  let s = seed || 1;
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    bars.push(0.22 + (s % 78) / 100);
  }
  return bars;
}

function Waveform({
  seed,
  progress,
  playing,
}: {
  seed: number;
  progress: number;
  playing: boolean;
}) {
  const bars = useMemo(() => seededBars(seed, 28), [seed]);
  return (
    <div className="flex h-7 flex-1 items-center gap-px" aria-hidden="true">
      {bars.map((h, i) => {
        const filled = i / bars.length <= progress;
        return (
          <span
            key={i}
            className={cn(
              "vozclara-bar w-[3px] rounded-full origin-center",
              filled ? "bg-wa-green" : "bg-wa-meta/70",
            )}
            style={{
              height: `${h * 100}%`,
              animation: playing
                ? `vozclara-bars 900ms ease-in-out ${i * 40}ms infinite`
                : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function VoiceBubble({
  msg,
  active,
  onToggle,
  onContext,
  onTranscribe,
  transcript,
  status,
}: {
  msg: Extract<ChatMessage, { kind: "voice" }>;
  active: { id: string; playing: boolean; progress: number } | null;
  onToggle: (id: string, el: HTMLAudioElement) => void;
  onContext: (e: MouseEvent, id: string) => void;
  onTranscribe: (id: string) => void;
  transcript?: string;
  status?: "idle" | "working" | "done" | "error";
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isThis = active?.id === msg.id;
  const playing = Boolean(isThis && active?.playing);
  const progress = isThis ? active?.progress ?? 0 : 0;
  const outgoing = msg.from === "out";

  return (
    <div
      className={cn("flex", outgoing ? "justify-end" : "justify-start")}
      data-voice-id={msg.id}
      onContextMenu={(e) => onContext(e, msg.id)}
    >
      <div className="max-w-[min(100%,22rem)]">
        <div
          className={cn(
            "rounded-lg px-2 py-1.5 shadow-sm",
            outgoing
              ? "rounded-tr-sm bg-wa-out"
              : "rounded-tl-sm bg-wa-in",
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wa-green text-wa-bg"
              onClick={() => {
                const el = audioRef.current;
                if (el) onToggle(msg.id, el);
              }}
              aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
            >
              {playing ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 translate-x-px fill-current" />
              )}
            </button>
            <Waveform seed={msg.seed} progress={progress} playing={playing} />
            <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-wa-meta">
              {formatClock(playing || progress > 0 ? msg.duration * (1 - progress) : msg.duration)}
            </span>
          </div>
          <audio
            ref={audioRef}
            src={msg.src}
            preload="metadata"
            className="hidden"
          />
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-wa-meta">
            {msg.time}
            {outgoing ? <CheckCheck className="size-3.5 text-wa-tick" /> : null}
          </p>
        </div>
        <div className="mt-1.5 mb-2 rounded-md border-l-2 border-wa-green bg-wa-panel px-3 py-2">
            {status === "working" ? (
              <p className="vozclara-shimmer text-xs font-medium">Transcrevendo…</p>
            ) : transcript ? (
              <>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-wa-green">
                    VozClara
                  </p>
                  <CopyButton text={transcript} />
                </div>
                <p className="text-[13.5px] leading-snug text-wa-text">{transcript}</p>
              </>
            ) : (
              <>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-wa-green">
                  VozClara
                </p>
                <button
                  type="button"
                  onClick={() => onTranscribe(msg.id)}
                  className="min-h-8 w-full rounded-md bg-wa-green px-3 text-[12.5px] font-semibold text-wa-bg hover:opacity-90"
                >
                  Transcrever
                </button>
              </>
            )}
          </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="text-wa-meta hover:text-wa-text"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      aria-label="Copiar transcrição"
    >
      {done ? (
        <span className="text-[10px] text-wa-green">Copiado</span>
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

function TextBubble({ msg }: { msg: Extract<ChatMessage, { kind: "text" }> }) {
  const outgoing = msg.from === "out";
  return (
    <div className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(100%,22rem)] rounded-lg px-2.5 py-1.5 text-[14.5px] leading-snug text-wa-text shadow-sm",
          outgoing ? "rounded-tr-sm bg-wa-out" : "rounded-tl-sm bg-wa-in",
        )}
      >
        <p>{msg.text}</p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-wa-meta">
          {msg.time}
          {outgoing ? <CheckCheck className="size-3.5 text-wa-tick" /> : null}
        </p>
      </div>
    </div>
  );
}

export function WhatsAppSimulator() {
  const [chatId, setChatId] = useState(DEMO_CHATS[0].id);
  const chat = DEMO_CHATS.find((c) => c.id === chatId) ?? DEMO_CHATS[0];
  const [active, setActive] = useState<{
    id: string;
    playing: boolean;
    progress: number;
  } | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, "working" | "done">>({});
  const [menu, setMenu] = useState<MenuState>(null);
  const [hint, setHint] = useState(true);
  const [coarse, setCoarse] = useState(false);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (ev: Event) => {
      const t = ev.target;
      if (t instanceof Element && t.closest("[data-ctx-menu]")) return;
      setMenu(null);
    };
    const id = window.setTimeout(() => {
      window.addEventListener("click", close);
      window.addEventListener("pointerdown", close);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [menu]);

  function toggle(id: string, el: HTMLAudioElement) {
    if (active?.id && active.id !== id) {
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== el) a.pause();
      });
    }
    if (active?.id === id && active.playing) {
      el.pause();
      setActive({ id, playing: false, progress: el.currentTime / (el.duration || 1) });
      return;
    }
    void el.play();
    setActive({ id, playing: true, progress: el.currentTime / (el.duration || 1) });
    const onTime = () => {
      setActive((cur) =>
        cur?.id === id
          ? { id, playing: !el.paused, progress: el.currentTime / (el.duration || 1) }
          : cur,
      );
    };
    const onEnd = () => setActive({ id, playing: false, progress: 1 });
    el.ontimeupdate = onTime;
    el.onended = onEnd;
  }

  function transcribe(id: string) {
    const msg = chat.messages.find((m) => m.id === id);
    if (!msg || msg.kind !== "voice") return;
    if (transcripts[id] || status[id] === "working") return;
    setHint(false);
    setMenu(null);
    setStatus((s) => ({ ...s, [id]: "working" }));
    window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => {
      setTranscripts((t) => ({ ...t, [id]: msg.transcript }));
      setStatus((s) => ({ ...s, [id]: "done" }));
    }, 900 + (msg.duration % 4) * 180);
  }

  function onContext(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const w = 240;
    const h = 88;
    const x = Math.min(e.clientX, window.innerWidth - w - pad);
    const y = Math.min(e.clientY, window.innerHeight - h - pad);
    setMenu({ x, y, id });
    setHint(false);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-wa-panel shadow-[0_24px_80px_-32px_rgba(0,0,0,0.65)]">
      <div className="grid min-h-[34rem] md:grid-cols-[16.5rem_1fr]">
        <aside className="hidden flex-col border-r border-black/40 bg-wa-panel md:flex">
          <div className="flex items-center gap-3 border-b border-black/30 bg-wa-header px-3 py-3">
            <div className="size-9 rounded-full bg-wa-input" />
            <p className="flex-1 text-sm text-wa-text">Conversas</p>
            <MoreVertical className="size-4 text-wa-meta" />
          </div>
          <div className="px-3 py-2">
            <div className="flex h-8 items-center gap-2 rounded-lg bg-wa-bg px-3 text-wa-meta">
              <Search className="size-3.5" />
              <span className="text-xs">Pesquisar</span>
            </div>
          </div>
          <ul className="flex-1 overflow-auto">
            {DEMO_CHATS.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setChatId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                    c.id === chatId ? "bg-wa-header" : "hover:bg-wa-header/60",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-green/20 text-xs font-medium text-wa-green">
                    {c.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-wa-text">{c.name}</span>
                      <span className="text-[11px] text-wa-meta">{c.time}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-wa-meta">
                        Mensagem de voz
                      </span>
                      {c.unread > 0 ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-wa-green text-[10px] font-medium text-wa-bg">
                          {c.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[34rem] flex-col">
          <header className="flex items-center gap-3 bg-wa-header px-3 py-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-wa-green/20 text-xs font-medium text-wa-green">
              {chat.initials}
            </span>
            <div className="min-w-0 flex-1">
              <select
                className="w-full bg-transparent text-sm font-medium text-wa-text md:pointer-events-none md:appearance-none"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                aria-label="Conversas"
              >
                {DEMO_CHATS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="truncate text-[11px] text-wa-meta">{chat.status}</p>
            </div>
            <div className="hidden items-center gap-4 text-wa-meta sm:flex">
              <Video className="size-4" />
              <Phone className="size-4" />
              <Search className="size-4" />
            </div>
          </header>

          <div className="wa-doodle relative flex-1 space-y-2 overflow-auto px-3 py-3 sm:px-6">
            {hint ? (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-[min(90%,18rem)] -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-center text-[11px] text-wa-text">
                {coarse
                  ? "Toque em Transcrever no áudio"
                  : "Clique com o botão direito em um áudio"}
              </div>
            ) : null}

            <p className="py-2 text-center text-[11px] text-wa-meta">Hoje</p>
            {chat.messages.map((msg) =>
              msg.kind === "text" ? (
                <TextBubble key={msg.id} msg={msg} />
              ) : (
                <VoiceBubble
                  key={msg.id}
                  msg={msg}
                  active={active}
                  onToggle={toggle}
                  onContext={onContext}
                  onTranscribe={transcribe}
                  transcript={transcripts[msg.id]}
                  status={status[msg.id]}
                />
              ),
            )}
          </div>

          <footer className="flex items-center gap-2 bg-wa-header px-2 py-2">
            <Smile className="size-5 text-wa-meta" />
            <div className="flex h-9 flex-1 items-center rounded-lg bg-wa-input px-3 text-sm text-wa-meta">
              Mensagem
            </div>
            <Mic className="size-5 text-wa-meta" />
            <SendHorizonal className="size-5 text-wa-meta" />
          </footer>
        </section>
      </div>

      {menu ? (
        <div
          data-ctx-menu="1"
          className="fixed z-50 min-w-56 overflow-hidden rounded-sm border border-border-strong bg-ctx py-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-fg hover:bg-ctx-hover"
            onClick={() => transcribe(menu.id)}
          >
            <span className="flex size-6 items-center justify-center rounded-xs bg-accent/15 text-accent">
              <Mic className="size-3.5" />
            </span>
            Transcrever com VozClara
          </button>
          <button
            type="button"
            className="flex w-full items-center px-3 py-2 text-left text-sm text-fg-muted hover:bg-ctx-hover hover:text-fg"
            onClick={() => setMenu(null)}
          >
            <span className="pl-9">Cancelar</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
