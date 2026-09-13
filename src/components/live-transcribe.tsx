import { useRef, useState } from "react";
import { Copy, Mic, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/transcribe";
import { blobToBase64, cn } from "@/lib/utils";
import { useLiveSettings } from "./settings-panel";

type Status = "idle" | "recording" | "busy";

export function LiveTranscribe() {
  const settings = useLiveSettings();
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(blob: Blob, fileName: string) {
    if (!settings) {
      toast.error("Aguarde um instante e tente de novo.");
      return;
    }
    setStatus("busy");
    setName(fileName);
    setText("");
    try {
      if (settings.provider === "local") {
        toast.error(
          "O Whisper local roda na extensão. Aqui no site, escolha um provedor de nuvem.",
        );
        setStatus("idle");
        return;
      }
      const audioBase64 = await blobToBase64(blob);
      const result = await transcribeAudio({
        data: {
          audioBase64,
          mimeType: blob.type || "audio/webm",
          fileName,
          provider: settings.apiKey ? settings.provider : "xai",
          apiKey: settings.apiKey || undefined,
          language: settings.language,
          sessionId: settings.sessionId,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        setStatus("idle");
        return;
      }
      setText(result.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao transcrever.");
    } finally {
      setStatus("idle");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Arquivo acima de 3 MB.");
      return;
    }
    await run(file, file.name);
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(tick.current);
        const blob = new Blob(chunks.current, { type: rec.mimeType });
        void run(blob, "gravacao.webm");
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setStatus("recording");
      tick.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 59) {
            rec.stop();
            recRef.current = null;
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Sem permissão para o microfone.");
    }
  }

  function stopRec() {
    recRef.current?.stop();
    recRef.current = null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-display text-2xl font-medium tracking-tight">
        Transcrever agora
      </h2>
      <p className="mt-1 max-w-xl text-sm text-fg-muted">
        Envie um ogg, mp3 ou m4a, ou grave pelo microfone. Serve para testar a
        chave — e no celular, para ler um áudio sem esperar o computador.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.ogg,.opus,.mp3,.m4a,.wav,.webm"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={status !== "idle"}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          Enviar áudio
        </Button>
        {status === "recording" ? (
          <Button type="button" className="flex-1 motion-safe:animate-pulse" onClick={stopRec}>
            <Square className="size-4 fill-current" />
            Parar {seconds}s
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={status !== "idle"}
            onClick={() => void startRec()}
          >
            <Mic className="size-4" />
            Gravar
          </Button>
        )}
      </div>

      <div
        className={cn(
          "mt-4 min-h-28 rounded-lg border border-border bg-bg px-4 py-3",
          status === "busy" && "opacity-80",
        )}
      >
        {status === "busy" ? (
          <div>
            <p className="vozclara-shimmer text-sm font-medium">Transcrevendo…</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
              <span className="block h-full w-2/5 rounded-full bg-accent motion-safe:animate-[vozclara-indeterminate_1.15s_ease-in-out_infinite]" />
            </div>
          </div>
        ) : text ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
                {name ?? "Transcrição"}
              </p>
              <button
                type="button"
                className="text-fg-muted hover:text-fg"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  toast.success("Copiado");
                }}
                aria-label="Copiar"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <p data-live-transcript="1" className="text-sm leading-relaxed text-fg">
              {text}
            </p>
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">
            A transcrição aparece aqui. Sem chave, o modo demonstração usa xAI
            com um limite curto.
          </p>
        )}
      </div>
    </div>
  );
}
